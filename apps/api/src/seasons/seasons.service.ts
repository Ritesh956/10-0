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
import type { CreateSeasonDto } from "./seasons.schemas.js";

const AI_CLUB_FORMATION = "4-4-2";

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

    await this.fillAiClubs(worldId, world.eraId, world.clubs, dto.size);
    const clubs = await this.prisma.worldClub.findMany({ where: { worldId } });
    if (clubs.length < 2) {
      throw new BadRequestException("Not enough clubs available in this era to form a season");
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
      where: { league: { eraId } },
      include: { club: true, playerSeasons: true },
      take: needed * 3 + usedRefClubSeasonIds.size,
    });
    const pool = candidates.filter((c) => !usedRefClubSeasonIds.has(c.id));

    // AI clubs get a random real manager unconditionally (invisible backend flavor) so the
    // league is tactically varied regardless of whether the human user drafted one for themself.
    const managerIds = (await this.prisma.refManager.findMany({ select: { id: true } })).map((m) => m.id);

    for (let i = 0; i < needed && i < pool.length; i++) {
      const clubSeason = pool[i];
      if (!clubSeason) continue;
      const draftPool: DraftCandidate[] = clubSeason.playerSeasons.map((ps) => ({
        refPlayerSeasonId: ps.id,
        positions: ps.positions as Position[],
        overall: ps.overall,
      }));
      const lineup = buildLineup(AI_CLUB_FORMATION, draftPool);
      await instantiateWorldClub(this.prisma, {
        worldId,
        name: clubSeason.club.name,
        refClubSeasonId: clubSeason.id,
        managedByUserId: undefined,
        formation: AI_CLUB_FORMATION,
        lineup,
        allPlayerSeasonIds: clubSeason.playerSeasons.map((p) => p.id),
        refManagerId: managerIds.length > 0 ? managerIds[randomInt(managerIds.length)] : undefined,
      });
    }
  }

  async requestSimulation(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const season = await this.prisma.season.findFirst({ where: { id: seasonId, worldId } });
    if (!season) throw new NotFoundException("Season not found");
    if (season.status === "COMPLETED") throw new BadRequestException("Season already completed");

    await this.prisma.season.update({ where: { id: seasonId }, data: { status: "IN_PROGRESS" } });
    await this.queue.add(
      SEASON_SIM_QUEUE,
      { worldId, seasonId },
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

    return { standings, userClub, userRow, position, unbeaten, shareText };
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
   * Aggregates PlayerMatchStat across every completed fixture a club played in this season —
   * top scorer/assister, goals for/against, and a full squad breakdown for the "your team" screen.
   */
  async getTeamStats(worldId: string, seasonId: string, clubId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);

    // PlayerMatchStat has no clubId of its own — every match's rows cover BOTH sides' full squads,
    // so without this the opposing team's players would get folded into "our" squad totals below.
    const clubPlayers = await this.prisma.worldPlayer.findMany({ where: { clubId }, select: { id: true, name: true } });
    const clubPlayerIds = new Set(clubPlayers.map((p) => p.id));
    const nameById = new Map(clubPlayers.map((p) => [p.id, p.name]));

    const fixtures = await this.prisma.fixture.findMany({
      where: {
        worldId,
        seasonId,
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
}
