import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { PrismaClient } from "@futbol/db";
import { buildStandings, SEASON_SIM_QUEUE, type CompletedResult, type Position } from "@futbol/domain";
import { PRISMA } from "../prisma/prisma.module.js";
import { SEASON_SIM_QUEUE_TOKEN } from "../queue/queue.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { buildLineup, type DraftCandidate } from "../common/lineup.js";
import { instantiateWorldClub } from "../common/instantiate-world-club.js";
import { generateDoubleRoundRobin } from "./round-robin.js";
import { computeManagerStats, findGoalkeeperId } from "./season-stats.logic.js";
import { evaluateTrophies } from "./trophy-evaluation.js";
import type { CreateSeasonDto } from "./seasons.schemas.js";

const AI_CLUB_FORMATION = "4-4-2";

/**
 * Mirrors apps/web/src/lib/leagues.ts's REAL_LEAGUE_COUNTRIES — the draft flow already restricts
 * the human's own club-season pool to these five real leagues, but AI-filled clubs pulled from
 * every era-scoped RefClubSeason regardless of country, which let fictional placeholder clubs
 * (fake names, generated attributes) end up seeded into the league table and, worse, into the
 * Champions League qualification spots right alongside the user's real club. Keep this list in
 * sync with the frontend one if the real dataset's country coverage ever changes.
 */
const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

@Injectable()
export class SeasonsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(SEASON_SIM_QUEUE_TOKEN) private readonly queue: Queue,
    @Inject(WorldsService) private readonly worlds: WorldsService,
  ) {}

  async createSeason(worldId: string, userId: string, dto: CreateSeasonDto) {
    const world = await this.worlds.getWorld(worldId, userId);
    if (world.clubs.length === 0) {
      throw new BadRequestException("Draft a club before creating a season");
    }

    if (dto.leagueId) {
      const league = await this.prisma.refLeague.findUnique({ where: { id: dto.leagueId } });
      if (!league || !REAL_LEAGUE_COUNTRIES.includes(league.country)) {
        throw new BadRequestException("Choose a real league to build a season around");
      }
      await this.fillAiClubsFromLeague(worldId, world.clubs, dto.leagueId);
    } else {
      await this.fillAiClubs(worldId, world.eraId, world.clubs, dto.size);
    }
    const clubs = await this.prisma.worldClub.findMany({ where: { worldId } });
    if (clubs.length < 2) {
      throw new BadRequestException("Not enough clubs available to form a season");
    }

    const competition = await this.prisma.competition.create({
      data: { worldId, name: dto.competitionName, type: "LEAGUE" },
    });
    const season = await this.prisma.season.create({
      data: {
        worldId,
        competitionId: competition.id,
        year: new Date().getFullYear(),
        status: "SCHEDULED",
      },
    });

    const fixtures = generateDoubleRoundRobin(clubs.map((c) => c.id));
    await this.prisma.fixture.createMany({
      data: fixtures.map((f) => ({
        worldId,
        seasonId: season.id,
        matchday: f.matchday,
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        status: "SCHEDULED" as const,
      })),
    });

    return this.prisma.season.findUnique({ where: { id: season.id }, include: { fixtures: true } });
  }

  private async fillAiClubs(
    worldId: string,
    eraId: string,
    existingClubs: { refClubSeasonId: string | null }[],
    targetSize: number,
  ): Promise<void> {
    const needed = targetSize - existingClubs.length;
    if (needed <= 0) return;

    const usedRefClubSeasonIds = new Set(
      existingClubs.map((c) => c.refClubSeasonId).filter((id): id is string => id !== null),
    );
    const candidates = await this.prisma.refClubSeason.findMany({
      where: { league: { eraId, country: { in: REAL_LEAGUE_COUNTRIES } } },
      include: { club: true, playerSeasons: true },
      take: needed * 3 + usedRefClubSeasonIds.size,
    });
    const pool = candidates.filter((c) => !usedRefClubSeasonIds.has(c.id));

    // AI clubs get a random real manager unconditionally (invisible backend flavor) so the
    // league is tactically varied regardless of whether the human user drafted one for themself.
    const managerIds = (await this.prisma.refManager.findMany({ select: { id: true } })).map((m) => m.id);

    // Each AI club is an independent insert — running them concurrently instead of one at a
    // time cuts wall-clock time roughly in proportion to the club count, since the dominant
    // cost is round-trip latency to a remote DB, not local CPU work.
    const toCreate = pool.slice(0, needed);
    await Promise.all(
      toCreate.map((clubSeason) => {
        const draftPool: DraftCandidate[] = clubSeason.playerSeasons.map((ps) => ({
          refPlayerSeasonId: ps.id,
          positions: ps.positions as Position[],
          overall: ps.overall,
        }));
        const lineup = buildLineup(AI_CLUB_FORMATION, draftPool);
        return instantiateWorldClub(this.prisma, {
          worldId,
          name: clubSeason.club.name,
          refClubSeasonId: clubSeason.id,
          managedByUserId: undefined,
          formation: AI_CLUB_FORMATION,
          lineup,
          allPlayerSeasonIds: clubSeason.playerSeasons.map((p) => p.id),
          refManagerId: managerIds.length > 0 ? managerIds[randomInt(managerIds.length)] : undefined,
        });
      }),
    );
  }

  /**
   * Fills the rest of the league with exactly this real league's actual current clubs — "current"
   * meaning the most recent season year the dataset has for it — instead of an arbitrary grab-bag
   * across every real league and era, which previously produced nonsense: the same handful of real
   * clubs (whichever happened to sort first) repeated 8-10 times over at different historical
   * seasons, next to one or two others, rather than a single recognizable current table. The
   * league's own real size (20 for the Premier League/LaLiga/Serie A, 18 for the Bundesliga/Ligue 1)
   * comes directly from how many distinct clubs that latest year actually has — no hardcoding.
   */
  private async fillAiClubsFromLeague(
    worldId: string,
    existingClubs: { refClubSeasonId: string | null }[],
    leagueId: string,
  ): Promise<void> {
    const yearAgg = await this.prisma.refClubSeason.aggregate({ where: { leagueId }, _max: { seasonYear: true } });
    const latestYear = yearAgg._max.seasonYear;
    if (latestYear == null) return;

    const candidates = await this.prisma.refClubSeason.findMany({
      where: { leagueId, seasonYear: latestYear },
      include: { club: true, playerSeasons: true },
    });

    // The dataset should already be one row per club per year, but dedupe defensively so a data
    // quirk can't seed the same real club twice into one league table.
    const seenClubIds = new Set<string>();
    const distinctClubSeasons = candidates.filter((c) => {
      if (seenClubIds.has(c.clubId)) return false;
      seenClubIds.add(c.clubId);
      return true;
    });

    // If the user's own club IS one of this league's real clubs (a squad-first draft of an
    // existing club-season), exclude that same real club from the AI pool — otherwise it would
    // appear twice: once as the user, once as an AI-controlled duplicate of itself.
    const usedRefClubSeasonIds = existingClubs.map((c) => c.refClubSeasonId).filter((id): id is string => id !== null);
    const usedClubIds = new Set(
      usedRefClubSeasonIds.length > 0
        ? (
            await this.prisma.refClubSeason.findMany({
              where: { id: { in: usedRefClubSeasonIds } },
              select: { clubId: true },
            })
          ).map((c) => c.clubId)
        : [],
    );

    // Total season size = this league's own real current size — every existing club (the user's,
    // and any other humans in a multiplayer world) takes one of those real slots regardless of
    // whether it happens to map to one of this league's actual clubs.
    const needed = distinctClubSeasons.length - existingClubs.length;
    if (needed <= 0) return;

    const pool = distinctClubSeasons.filter((c) => !usedClubIds.has(c.clubId)).slice(0, needed);
    const managerIds = (await this.prisma.refManager.findMany({ select: { id: true } })).map((m) => m.id);

    await Promise.all(
      pool.map((clubSeason) => {
        const draftPool: DraftCandidate[] = clubSeason.playerSeasons.map((ps) => ({
          refPlayerSeasonId: ps.id,
          positions: ps.positions as Position[],
          overall: ps.overall,
        }));
        const lineup = buildLineup(AI_CLUB_FORMATION, draftPool);
        return instantiateWorldClub(this.prisma, {
          worldId,
          name: clubSeason.club.name,
          refClubSeasonId: clubSeason.id,
          managedByUserId: undefined,
          formation: AI_CLUB_FORMATION,
          lineup,
          allPlayerSeasonIds: clubSeason.playerSeasons.map((p) => p.id),
          refManagerId: managerIds.length > 0 ? managerIds[randomInt(managerIds.length)] : undefined,
        });
      }),
    );
  }

  /**
   * `throughMatchday`, when given, tells the worker to stop after simulating that matchday instead
   * of the whole season — the January Transfer Window's domestic-season split (see process-season.ts
   * and JanuaryService). The worker only ever pulls SCHEDULED fixtures and only marks the Season
   * COMPLETED once none remain, so a paused first half simply leaves the Season IN_PROGRESS; calling
   * this again later (with no `throughMatchday`) picks up the rest, reading whatever lineup/roster
   * changes were made to WorldClub/WorldPlayer in between (the worker re-reads both fresh every job).
   */
  async requestSimulation(worldId: string, seasonId: string, userId: string, throughMatchday?: number) {
    await this.worlds.assertOwnership(worldId, userId);
    const season = await this.prisma.season.findFirst({ where: { id: seasonId, worldId } });
    if (!season) throw new NotFoundException("Season not found");
    if (season.status === "COMPLETED") throw new BadRequestException("Season already completed");

    await this.prisma.season.update({ where: { id: seasonId }, data: { status: "IN_PROGRESS" } });
    await this.queue.add(
      SEASON_SIM_QUEUE,
      { worldId, seasonId, ...(throughMatchday !== undefined ? { throughMatchday } : {}) },
      { removeOnComplete: true, removeOnFail: 50 },
    );
    return { status: "queued" as const };
  }

  async getSeason(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const season = await this.prisma.season.findFirst({
      where: { id: seasonId, worldId },
      include: { fixtures: { orderBy: { matchday: "asc" } } },
    });
    if (!season) throw new NotFoundException("Season not found");
    return season;
  }

  async getStandings(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const season = await this.prisma.season.findFirst({ where: { id: seasonId, worldId } });
    if (!season) throw new NotFoundException("Season not found");

    const [clubs, fixtures] = await Promise.all([
      this.prisma.worldClub.findMany({ where: { worldId } }),
      this.prisma.fixture.findMany({
        where: { worldId, seasonId, status: "COMPLETED" },
        include: { match: true },
      }),
    ]);

    const results: CompletedResult[] = fixtures
      .filter((f): f is typeof f & { match: NonNullable<(typeof f)["match"]> } => f.match !== null)
      .map((f) => ({
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeScore: f.match.homeScore,
        awayScore: f.match.awayScore,
      }));

    return buildStandings(
      seasonId,
      clubs.map((c) => c.id),
      results,
    );
  }

  async getSummary(worldId: string, seasonId: string, userId: string) {
    const [standings, world] = await Promise.all([
      this.getStandings(worldId, seasonId, userId),
      this.worlds.getWorld(worldId, userId),
    ]);

    const userClub = world.clubs.find((c) => c.managedByUserId === userId);
    const userRow = userClub ? standings.rows.find((r) => r.clubId === userClub.id) : undefined;
    const position = userRow ? standings.rows.findIndex((r) => r.clubId === userRow.clubId) + 1 : undefined;
    const unbeaten = userRow ? userRow.played > 0 && userRow.lost === 0 : false;

    const shareText =
      userClub && userRow
        ? `${userClub.name} finished ${position ? `#${position}` : "?"} with a record of ${userRow.won}W-${userRow.drawn}D-${userRow.lost}L` +
          (unbeaten && userRow.played > 0 ? " — unbeaten! 🔥" : "")
        : undefined;

    // Squad snapshot (position + overall per starting-XI slot), for the frontend's season-narrative
    // engine to group into Attack/Midfield/Defence/Goalkeeping — reusing lib/formations.ts's
    // POSITION_GROUP client-side rather than duplicating that grouping table on the backend too.
    let squad: { position: string; overall: number }[] | undefined;
    let squadOverall: number | undefined;
    if (userClub) {
      const lineup = ((userClub.lineup as { position: string; playerId: string }[] | null) ?? []).filter((s) =>
        Boolean(s?.playerId),
      );
      if (lineup.length > 0) {
        const players = await this.prisma.worldPlayer.findMany({
          where: { id: { in: lineup.map((s) => s.playerId) } },
          select: { id: true, overall: true },
        });
        const overallById = new Map(players.map((p) => [p.id, p.overall]));
        squad = lineup
          .map((s) => {
            const overall = overallById.get(s.playerId);
            return overall !== undefined ? { position: s.position, overall } : undefined;
          })
          .filter((s): s is { position: string; overall: number } => s !== undefined);
        if (squad.length > 0) squadOverall = Math.round(squad.reduce((sum, s) => sum + s.overall, 0) / squad.length);
      }
    }

    return { standings, userClub, userRow, position, unbeaten, shareText, squad, squadOverall };
  }

  /**
   * Per-fixture score + goal-by-goal breakdown (scorer/assist names resolved from the WorldPlayer
   * snapshot, not the ref catalog — matches what actually played, including any mid-world changes).
   * Ordered by matchday so the frontend can play them back like a season unfolding.
   */
  async getMatchesWithEvents(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);

    const fixtures = await this.prisma.fixture.findMany({
      where: { worldId, seasonId, status: "COMPLETED" },
      orderBy: { matchday: "asc" },
      include: { match: { include: { events: { orderBy: { seq: "asc" } } } } },
    });

    const playerIds = new Set<string>();
    for (const fixture of fixtures) {
      for (const event of fixture.match?.events ?? []) {
        if (event.type !== "goal") continue;
        const payload = event.payload as { playerId?: string; assistPlayerId?: string };
        if (payload.playerId) playerIds.add(payload.playerId);
        if (payload.assistPlayerId) playerIds.add(payload.assistPlayerId);
      }
    }
    const players = await this.prisma.worldPlayer.findMany({
      where: { id: { in: [...playerIds] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(players.map((p) => [p.id, p.name]));

    return fixtures
      .filter((fixture): fixture is typeof fixture & { match: NonNullable<(typeof fixture)["match"]> } =>
        fixture.match !== null,
      )
      .map((fixture) => ({
        fixtureId: fixture.id,
        matchday: fixture.matchday,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        homeScore: fixture.match.homeScore,
        awayScore: fixture.match.awayScore,
        goals: fixture.match.events
          .filter((event) => event.type === "goal")
          .map((event) => {
            const payload = event.payload as { clubId?: string; playerId?: string; assistPlayerId?: string };
            return {
              minute: event.minute,
              clubId: payload.clubId ?? fixture.homeClubId,
              scorerName: (payload.playerId && nameById.get(payload.playerId)) ?? "Unknown",
              assistName: payload.assistPlayerId ? nameById.get(payload.assistPlayerId) : undefined,
            };
          }),
      }));
  }

  /**
   * Aggregates PlayerMatchStat across every completed fixture a club played across the given
   * seasons — top scorer/assister, goals for/against, and a full squad breakdown for the "your
   * team" screen. Shared by getTeamStats (one season — the domestic league) and
   * getTeamStatsForCompetition (every season under a competition — Champions League spans a
   * separate Season row per stage: league phase, QF, SF, Final).
   */
  private async aggregateTeamStats(worldId: string, seasonIds: string[], clubId: string) {
    // PlayerMatchStat has no clubId of its own — every match's rows cover BOTH sides' full squads,
    // so without this the opposing team's players would get folded into "our" squad totals below.
    const clubPlayers = await this.prisma.worldPlayer.findMany({ where: { clubId }, select: { id: true, name: true } });
    const clubPlayerIds = new Set(clubPlayers.map((p) => p.id));
    const nameById = new Map(clubPlayers.map((p) => [p.id, p.name]));

    const fixtures = await this.prisma.fixture.findMany({
      where: {
        worldId,
        seasonId: { in: seasonIds },
        status: "COMPLETED",
        OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
      },
      include: { match: { include: { playerStats: true } } },
    });

    let goalsFor = 0;
    let goalsAgainst = 0;
    const totals = new Map<string, { matchesPlayed: number; goals: number; assists: number }>();

    for (const fixture of fixtures) {
      if (!fixture.match) continue;
      const isHome = fixture.homeClubId === clubId;
      goalsFor += isHome ? fixture.match.homeScore : fixture.match.awayScore;
      goalsAgainst += isHome ? fixture.match.awayScore : fixture.match.homeScore;

      for (const stat of fixture.match.playerStats) {
        if (!clubPlayerIds.has(stat.playerId)) continue;
        const entry = totals.get(stat.playerId) ?? { matchesPlayed: 0, goals: 0, assists: 0 };
        if (stat.minutesPlayed > 0) entry.matchesPlayed += 1;
        entry.goals += stat.goals;
        entry.assists += stat.assists;
        totals.set(stat.playerId, entry);
      }
    }

    const squad = [...totals.entries()]
      .map(([playerId, stat]) => ({ playerId, name: nameById.get(playerId) ?? "Unknown", ...stat }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

    const topScorer = [...squad].sort((a, b) => b.goals - a.goals)[0];
    const topAssist = [...squad].sort((a, b) => b.assists - a.assists)[0];

    return {
      clubId,
      goalsFor,
      goalsAgainst,
      topScorer: topScorer && topScorer.goals > 0 ? topScorer : undefined,
      topAssist: topAssist && topAssist.assists > 0 ? topAssist : undefined,
      squad,
    };
  }

  async getTeamStats(worldId: string, seasonId: string, clubId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    return this.aggregateTeamStats(worldId, [seasonId], clubId);
  }

  /** Same as getTeamStats, but rolled up across every Season row under a competition (the Champions
      League's league phase + QF + SF + Final are each a separate Season sharing one competitionId). */
  async getTeamStatsForCompetition(worldId: string, competitionId: string, clubId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const seasons = await this.prisma.season.findMany({ where: { worldId, competitionId }, select: { id: true } });
    return this.aggregateTeamStats(worldId, seasons.map((s) => s.id), clubId);
  }

  /**
   * Competition-wide (not just "my club") leaderboard: every player's goals/assists/average rating
   * across every completed fixture in every season under this competition — powers the Golden Boot,
   * Playmaker, Golden Glove, MVP, and top-scorers list on the post-season stats page. `mvp` requires
   * a minimum match count (a quarter of whatever the most-used player logged) so a single standout
   * cameo can't win it. `goldenGlove` is attributed to a named goalkeeper (parsed from each clean
   * sheet's Match.setup, see findGoalkeeperId) rather than just the club, so all four awards read as
   * consistently "a player won this" rather than three player awards and one club-level one.
   */
  async getCompetitionStats(worldId: string, competitionId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);

    const seasons = await this.prisma.season.findMany({ where: { worldId, competitionId }, select: { id: true } });
    const seasonIds = seasons.map((s) => s.id);
    if (seasonIds.length === 0) {
      return { topScorers: [], goldenBoot: undefined, mvp: undefined, playmaker: undefined, goldenGlove: undefined };
    }

    const fixtures = await this.prisma.fixture.findMany({
      where: { worldId, seasonId: { in: seasonIds }, status: "COMPLETED" },
      include: { match: { include: { playerStats: true } } },
    });

    const totals = new Map<string, { goals: number; assists: number; matchesPlayed: number; ratingSum: number }>();
    const cleanSheetsByKeeper = new Map<string, number>();
    for (const fixture of fixtures) {
      if (!fixture.match) continue;
      for (const stat of fixture.match.playerStats) {
        const entry = totals.get(stat.playerId) ?? { goals: 0, assists: 0, matchesPlayed: 0, ratingSum: 0 };
        entry.goals += stat.goals;
        entry.assists += stat.assists;
        if (stat.minutesPlayed > 0) {
          entry.matchesPlayed += 1;
          entry.ratingSum += stat.rating;
        }
        totals.set(stat.playerId, entry);
      }

      if (fixture.match.awayScore === 0) {
        const gkId = findGoalkeeperId(fixture.match.setup, fixture.homeClubId);
        if (gkId) cleanSheetsByKeeper.set(gkId, (cleanSheetsByKeeper.get(gkId) ?? 0) + 1);
      }
      if (fixture.match.homeScore === 0) {
        const gkId = findGoalkeeperId(fixture.match.setup, fixture.awayClubId);
        if (gkId) cleanSheetsByKeeper.set(gkId, (cleanSheetsByKeeper.get(gkId) ?? 0) + 1);
      }
    }

    const playerIds = [...totals.keys()];
    const players = await this.prisma.worldPlayer.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true, clubId: true },
    });
    const clubs = await this.prisma.worldClub.findMany({
      where: { id: { in: [...new Set(players.map((p) => p.clubId))] } },
      select: { id: true, name: true },
    });
    const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));
    const playerMetaById = new Map(players.map((p) => [p.id, p]));

    const rows = playerIds.map((playerId) => {
      const meta = playerMetaById.get(playerId);
      const stat = totals.get(playerId)!;
      return {
        playerId,
        name: meta?.name ?? "Unknown",
        clubId: meta?.clubId ?? "",
        clubName: meta ? (clubNameById.get(meta.clubId) ?? "Unknown") : "Unknown",
        goals: stat.goals,
        assists: stat.assists,
        matchesPlayed: stat.matchesPlayed,
        avgRating: stat.matchesPlayed > 0 ? stat.ratingSum / stat.matchesPlayed : 0,
      };
    });

    const topScorers = rows
      .filter((r) => r.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
      .slice(0, 10);
    const goldenBoot = topScorers[0];

    const maxMatches = Math.max(0, ...rows.map((r) => r.matchesPlayed));
    const mvpThreshold = Math.max(1, Math.floor(maxMatches * 0.25));
    const mvp = rows
      .filter((r) => r.matchesPlayed >= mvpThreshold)
      .sort((a, b) => b.avgRating - a.avgRating)[0];

    const playmaker = rows
      .filter((r) => r.assists > 0)
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0];

    const rowByPlayerId = new Map(rows.map((r) => [r.playerId, r]));
    const goldenGlove = [...cleanSheetsByKeeper.entries()]
      .map(([playerId, cleanSheets]) => {
        const row = rowByPlayerId.get(playerId);
        return row ? { ...row, cleanSheets } : undefined;
      })
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
      .sort((a, b) => b.cleanSheets - a.cleanSheets)[0];

    return { topScorers, goldenBoot, mvp, playmaker, goldenGlove };
  }

  /**
   * One club's own season, from its manager's perspective: clean sheets, longest win streak,
   * biggest win, and highest-scoring match — attributed to whichever RefManager the club drew (or
   * null for a manager-less club). Walked in matchday order (unlike getCompetitionStats, which has
   * no streak concept) so "longest win streak" is a genuine consecutive-run count, not just a tally.
   */
  async getManagerStats(worldId: string, competitionId: string, clubId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);

    const seasons = await this.prisma.season.findMany({ where: { worldId, competitionId }, select: { id: true } });
    const seasonIds = seasons.map((s) => s.id);

    const fixtures = await this.prisma.fixture.findMany({
      where: {
        worldId,
        seasonId: { in: seasonIds },
        status: "COMPLETED",
        OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
      },
      orderBy: { matchday: "asc" },
      include: { match: true },
    });

    const results = fixtures
      .filter((f): f is typeof f & { match: NonNullable<(typeof f)["match"]> } => f.match !== null)
      .map((f) => {
        const isHome = f.homeClubId === clubId;
        return {
          opponentClubId: isHome ? f.awayClubId : f.homeClubId,
          ourScore: isHome ? f.match.homeScore : f.match.awayScore,
          theirScore: isHome ? f.match.awayScore : f.match.homeScore,
        };
      });
    const { cleanSheets, longestWinStreak, biggestWin, highestScoringMatch } = computeManagerStats(results);

    const club = await this.prisma.worldClub.findUnique({ where: { id: clubId }, include: { refManager: true } });

    return {
      manager: club?.refManager
        ? { name: club.refManager.name, nationality: club.refManager.nationality, philosophy: club.refManager.philosophy }
        : null,
      cleanSheets,
      longestWinStreak,
      biggestWin,
      highestScoringMatch,
    };
  }

  /**
   * Persists the durable record of a finished run — trophies (Achievement), the competition's
   * final awards (Award, reusing the same live computation getCompetitionStats already does —
   * Phase 4 deliberately left these unpersisted pending this method), and this world's own headline
   * numbers (WorldRecord: points total, longest win streak, biggest win margin). Called once by the
   * frontend right as the stats hub is reached (not from the worker — a Competition can span
   * several Season rows, e.g. Europe's league-phase/QF/SF/Final, so only the caller who knows the
   * whole pipeline has actually finished can safely call this).
   *
   * Idempotent: every persisted row's unique constraint (`@@unique` on Achievement/Award/
   * WorldRecord) plus `createMany({ skipDuplicates: true })` means calling this twice for the same
   * world/season is a safe no-op the second time, not a duplicate-row pile-up.
   */
  async finalizeRun(worldId: string, seasonId: string, userId: string) {
    const season = await this.prisma.season.findFirst({ where: { id: seasonId, worldId } });
    if (!season) throw new NotFoundException("Season not found");

    const world = await this.worlds.getWorld(worldId, userId);
    const userClub = world.clubs.find((c) => c.managedByUserId === userId);
    if (!userClub) throw new BadRequestException("You don't manage a club in this world");

    const [standings, competitionStats, managerStats] = await Promise.all([
      this.getStandings(worldId, seasonId, userId),
      this.getCompetitionStats(worldId, season.competitionId, userId),
      this.getManagerStats(worldId, season.competitionId, userClub.id, userId),
    ]);

    const position = standings.rows.findIndex((r) => r.clubId === userClub.id) + 1;
    const userRow = standings.rows.find((r) => r.clubId === userClub.id);
    if (!userRow || position === 0) {
      throw new BadRequestException("Could not resolve a final standing for this club");
    }

    const trophies = evaluateTrophies({
      userClubId: userClub.id,
      played: userRow.played,
      won: userRow.won,
      drawn: userRow.drawn,
      lost: userRow.lost,
      position,
      goldenBootClubId: competitionStats.goldenBoot?.clubId,
      playmakerClubId: competitionStats.playmaker?.clubId,
      goldenGloveClubId: competitionStats.goldenGlove?.clubId,
      mvpClubId: competitionStats.mvp?.clubId,
    });

    const awardRows: { worldId: string; seasonId: string; name: string; winnerId: string }[] = [];
    if (competitionStats.goldenBoot) {
      awardRows.push({ worldId, seasonId, name: "golden-boot", winnerId: competitionStats.goldenBoot.playerId });
    }
    if (competitionStats.mvp) {
      awardRows.push({ worldId, seasonId, name: "mvp", winnerId: competitionStats.mvp.playerId });
    }
    if (competitionStats.playmaker) {
      awardRows.push({ worldId, seasonId, name: "playmaker", winnerId: competitionStats.playmaker.playerId });
    }
    if (competitionStats.goldenGlove) {
      awardRows.push({ worldId, seasonId, name: "golden-glove", winnerId: competitionStats.goldenGlove.playerId });
    }

    const recordRows = [
      { worldId, name: "points-total", holderId: userClub.id, value: userRow.points },
      { worldId, name: "longest-win-streak", holderId: userClub.id, value: managerStats.longestWinStreak },
      ...(managerStats.biggestWin
        ? [{ worldId, name: "biggest-win-margin", holderId: userClub.id, value: managerStats.biggestWin.margin }]
        : []),
    ];

    await Promise.all([
      this.prisma.achievement.createMany({
        data: trophies.map((key) => ({ worldId, userId, key })),
        skipDuplicates: true,
      }),
      awardRows.length > 0
        ? this.prisma.award.createMany({ data: awardRows, skipDuplicates: true })
        : Promise.resolve(),
      this.prisma.worldRecord.createMany({ data: recordRows, skipDuplicates: true }),
    ]);

    return { trophies, awards: awardRows, records: recordRows };
  }
}
