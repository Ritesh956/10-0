import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { buildStandings, type CompletedResult, type Position } from "@futbol/domain";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { AI_CLUB_FORMATION, REAL_LEAGUE_COUNTRIES, SeasonsService } from "../seasons/seasons.service.js";
import { buildLineup, type DraftCandidate } from "../common/lineup.js";
import { instantiateWorldClub } from "../common/instantiate-world-club.js";
import { aggregateTieScore, type PlayedLeg } from "./europe.logic.js";
import {
  bracketOrder,
  DIRECT_QUALIFIERS,
  generateLeaguePhase,
  KNOCKOUT_STAGES,
  nextRoundPairings,
  playoffPairings,
  r16Pairings,
  seedEntrants,
  type Entrant,
  type KnockoutStage,
  type Pairing,
  type RankedClub,
} from "./european-format.js";

/**
 * European Nights: 36 clubs from the five real leagues. The user's own league sends its top
 * `DOMESTIC_QUALIFIERS` finishers (real results — they just played the season); each of the other
 * four sends the `FOREIGN_QUALIFIERS` strongest current squads by our own ratings (those leagues
 * aren't simulated, so "strongest squad" stands in for "finished high"). The foreign clubs are
 * instantiated into the world as ordinary AI clubs so the existing worker simulates every fixture —
 * which is also why the whole competition, including ties the user isn't in, has a real result.
 *
 * Format: an 8-game league phase (see european-format.ts), then top 8 → Round of 16, 9–24 →
 * two-legged play-off, then R16 → QF → SF → a single-match neutral-venue Final.
 */
const DOMESTIC_QUALIFIERS = 8;
const FOREIGN_QUALIFIERS = 7;
const COMPETITION_NAME = "European Nights";
/**
 * The second European tier: a straight 16-club knockout for the next group down. Domestic places
 * 9-12 (`CUP_DOMESTIC_QUALIFIERS`) plus the 8th-10th strongest squads of each other league. It's a
 * `CONTINENTAL` competition told apart from European Nights by name (no schema change): anything
 * `CONTINENTAL` not called this is tier one - which also covers worlds created when tier one was
 * still named "Champions League".
 */
export const CUP_NAME = "Continental Cup";
const CUP_DOMESTIC_FIRST = 9;
const CUP_DOMESTIC_QUALIFIERS = 4;
const CUP_FOREIGN_SKIP = FOREIGN_QUALIFIERS;
const CUP_FOREIGN_TAKE = 3;

const NEXT_STAGE: Record<Exclude<KnockoutStage, "FINAL">, KnockoutStage> = {
  PO: "R16",
  R16: "QF",
  QF: "SF",
  SF: "FINAL",
};

/** Average overall of a club's best eleven — the seeding strength. */
function squadStrength(overalls: number[]): number {
  const best = [...overalls].sort((a, b) => b - a).slice(0, 11);
  return best.length === 0 ? 0 : best.reduce((sum, o) => sum + o, 0) / best.length;
}

function isStage(value: string): value is KnockoutStage {
  return (KNOCKOUT_STAGES as readonly string[]).includes(value);
}

@Injectable()
export class EuropeService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
    @Inject(SeasonsService) private readonly seasons: SeasonsService,
  ) {}

  async getStatus(worldId: string, domesticSeasonId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);
    const standings = await this.seasons.getStandings(worldId, domesticSeasonId, userId);
    const userClub = world.clubs.find((c) => c.managedByUserId === userId);
    const position = userClub ? standings.rows.findIndex((r) => r.clubId === userClub.id) + 1 : 0;
    const qualified = position > 0 && position <= DOMESTIC_QUALIFIERS;

    const competition = await this.tierOne(worldId);
    const ties = competition
      ? await this.withScores(await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId: competition.id } }))
      : [];

    // The Continental Cup is for the group just below Europe proper.
    const cupQualified =
      !qualified && position >= CUP_DOMESTIC_FIRST && position < CUP_DOMESTIC_FIRST + CUP_DOMESTIC_QUALIFIERS;
    const cupCompetition = await this.cupCompetition(worldId);

    return {
      qualified,
      position,
      qualifierCount: DOMESTIC_QUALIFIERS,
      clubCount: DOMESTIC_QUALIFIERS + 4 * FOREIGN_QUALIFIERS,
      competitionId: competition?.id,
      ties,
      cup: {
        qualified: cupQualified,
        clubCount: CUP_DOMESTIC_QUALIFIERS + 4 * CUP_FOREIGN_TAKE,
        competitionId: cupCompetition?.id,
      },
    };
  }

  /**
   * Builds the 36-club field, draws the league phase and queues its simulation. Calling it again for
   * a world that already has the competition returns that competition rather than drawing a second.
   */
  async startLeaguePhase(worldId: string, domesticSeasonId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);

    const existing = await this.tierOne(worldId);
    if (existing) {
      const first = await this.prisma.season.findFirst({ where: { worldId, competitionId: existing.id }, orderBy: { createdAt: "asc" } });
      if (first) return { competitionId: existing.id, seasonId: first.id, draw: await this.buildDraw(worldId, first.id, userId) };
    }

    const standings = await this.seasons.getStandings(worldId, domesticSeasonId, userId);
    const domesticClubIds = standings.rows.slice(0, DOMESTIC_QUALIFIERS).map((r) => r.clubId);
    if (domesticClubIds.length < DOMESTIC_QUALIFIERS) {
      throw new BadRequestException("Not enough qualified clubs to run a European competition");
    }

    const domesticLeague = await this.resolveDomesticLeague(world);
    const foreignClubIds = await this.addForeignClubs(world, domesticLeague?.id ?? null);
    const entrants = await this.entrantsFor(worldId, [...domesticClubIds, ...foreignClubIds], domesticLeague?.country ?? "Home");
    // A thin data set can leave the field short of a multiple of four (the pots must be equal);
    // the weakest foreign clubs are the ones left out.
    const domestic = new Set(domesticClubIds);
    const leftOut = new Set(
      entrants
        .filter((e) => !domestic.has(e.clubId))
        .sort((a, b) => a.strength - b.strength)
        .slice(0, entrants.length % 4)
        .map((e) => e.clubId),
    );
    const seeded = seedEntrants(entrants.filter((e) => !leftOut.has(e.clubId)));
    const fixtures = generateLeaguePhase(seeded, randomInt(2 ** 31));

    const competition = await this.prisma.competition.create({
      data: { worldId, name: COMPETITION_NAME, type: "CONTINENTAL" },
    });
    const season = await this.prisma.season.create({
      data: { worldId, competitionId: competition.id, year: new Date().getFullYear(), status: "SCHEDULED" },
    });
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

    await this.seasons.requestSimulation(worldId, season.id, userId);
    return { competitionId: competition.id, seasonId: season.id, draw: await this.buildDraw(worldId, season.id, userId) };
  }

  /** The pots and who was drawn — recomputed from the league-phase clubs, so it also serves a reload. */
  async getDraw(worldId: string, competitionId: string, userId: string) {
    const competition = await this.prisma.competition.findFirst({ where: { id: competitionId, worldId } });
    if (competition?.name === CUP_NAME) return this.buildCupDraw(worldId, competitionId, userId);
    const season = await this.prisma.season.findFirst({ where: { worldId, competitionId }, orderBy: { createdAt: "asc" } });
    if (!season) throw new NotFoundException("No league phase for this competition");
    return this.buildDraw(worldId, season.id, userId);
  }

  /**
   * The Continental Cup: for a club that finished 9th-12th, a 16-club knockout (R16 to Final, two
   * legs but the Final) against the next tier of clubs from the other four leagues. Calling it again
   * returns the existing competition's first round instead of drawing a second.
   */
  async startCup(worldId: string, domesticSeasonId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);
    const existing = await this.cupCompetition(worldId);
    if (existing) {
      const first = await this.prisma.season.findFirst({ where: { worldId, competitionId: existing.id }, orderBy: { createdAt: "asc" } });
      const ties = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId: existing.id, round: "R16" } });
      if (first) {
        return { competitionId: existing.id, round: { round: "R16" as const, seasonId: first.id, ties }, draw: await this.buildCupDraw(worldId, existing.id, userId) };
      }
    }

    const standings = await this.seasons.getStandings(worldId, domesticSeasonId, userId);
    const domesticIds = standings.rows
      .slice(CUP_DOMESTIC_FIRST - 1, CUP_DOMESTIC_FIRST - 1 + CUP_DOMESTIC_QUALIFIERS)
      .map((r) => r.clubId);
    if (domesticIds.length < CUP_DOMESTIC_QUALIFIERS) throw new BadRequestException("Not enough clubs for the Continental Cup");

    const domesticLeague = await this.resolveDomesticLeague(world);
    const foreignIds = await this.addForeignClubs(world, domesticLeague?.id ?? null, { skip: CUP_FOREIGN_SKIP, take: CUP_FOREIGN_TAKE });
    const entrants = await this.entrantsFor(worldId, [...domesticIds, ...foreignIds], domesticLeague?.country ?? "Home");
    const seeded = seedEntrants(entrants.length % 4 === 0 ? entrants : entrants.slice(0, entrants.length - (entrants.length % 4)));
    const ranked: RankedClub[] = seeded.map((s) => ({ clubId: s.clubId, rank: s.seed }));

    const competition = await this.prisma.competition.create({ data: { worldId, name: CUP_NAME, type: "CONTINENTAL" } });
    const round = await this.createRound(worldId, competition.id, "R16", nextRoundPairings(ranked), userId);
    return { competitionId: competition.id, round, draw: await this.buildCupDraw(worldId, competition.id, userId) };
  }

  /** The cup's field, rebuilt from its first-round ties (seed = strength order, as when it was drawn). */
  private async buildCupDraw(worldId: string, competitionId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);
    const ties = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId, round: "R16" } });
    const clubIds = ties.flatMap((t) => [t.homeClubId, t.awayClubId]);
    const domesticLeague = await this.resolveDomesticLeague(world);
    const entrants = await this.entrantsFor(worldId, clubIds, domesticLeague?.country ?? "Home");
    const nameById = new Map(world.clubs.map((c) => [c.id, c.name]));
    const seeded = seedEntrants(entrants);
    return {
      clubs: seeded.map((s) => ({
        clubId: s.clubId,
        name: nameById.get(s.clubId) ?? "Unknown",
        country: s.country,
        seed: s.seed,
        pot: s.pot,
        strength: Math.round(s.strength),
      })),
    };
  }

  private tierOne(worldId: string) {
    return this.prisma.competition.findFirst({
      where: { worldId, type: "CONTINENTAL", name: { not: CUP_NAME } },
      orderBy: { id: "asc" },
    });
  }

  private cupCompetition(worldId: string) {
    return this.prisma.competition.findFirst({ where: { worldId, type: "CONTINENTAL", name: CUP_NAME } });
  }

  /** Starts the play-off round from the completed league-phase table (9v24 ... 16v17). */
  async startKnockouts(worldId: string, competitionId: string, leaguePhaseSeasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const table = await this.rankedTable(worldId, leaguePhaseSeasonId);
    if (table.length < DIRECT_QUALIFIERS * 3) {
      throw new BadRequestException("League phase hasn't produced enough clubs for a knockout bracket");
    }
    return this.createRound(worldId, competitionId, "PO", playoffPairings(table), userId);
  }

  /**
   * Resolves the given round's ties (by aggregate, penalties if level) and, unless this was the
   * Final, creates the next round on top. The caller gets both the just-decided ties (to show a
   * winner announcement) and the next round to simulate/reveal — kept separate rather than merged
   * into one ambiguous "ties" array.
   */
  async advanceKnockouts(worldId: string, competitionId: string, round: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    if (!isStage(round)) throw new BadRequestException(`Unknown knockout round "${round}"`);
    const ties = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId, round } });
    if (ties.length === 0) throw new NotFoundException(`No ${round} ties found for this competition`);

    const resolved = await Promise.all(ties.map((tie) => this.resolveTie(tie)));
    const resolvedTies = await this.withScores(resolved);

    if (round === "FINAL") {
      return { resolvedRound: round, resolvedTies, champion: resolvedTies[0]?.winnerClubId };
    }

    const competition = await this.prisma.competition.findFirst({ where: { id: competitionId, worldId } });
    const leagueTable =
      competition?.name === CUP_NAME ? await this.cupSeedTable(worldId, competitionId) : await this.leaguePhaseTable(worldId, competitionId);
    const rankByClub = new Map(leagueTable.map((c) => [c.clubId, c.rank]));
    const ranked = (clubId: string): RankedClub => ({ clubId, rank: rankByClub.get(clubId) ?? 99 });

    let pairs: Pairing[];
    if (round === "PO") {
      pairs = r16Pairings(
        leagueTable,
        resolved.map((tie) => ({
          strongerRank: ranked(tie.homeClubId).rank,
          winner: ranked(tie.winnerClubId!),
        })),
      );
    } else {
      // Bracket order is recovered from who played whom, not from the order rows come back in.
      const every = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId } });
      const byRound: Partial<Record<KnockoutStage, { id: string; homeClubId: string; awayClubId: string }[]>> = {};
      for (const t of every) (byRound[t.round] ??= []).push(t);
      const slot = bracketOrder(byRound, (clubId) => ranked(clubId).rank);
      const winners = [...resolved]
        .sort((a, b) => (slot.get(a.id) ?? 0) - (slot.get(b.id) ?? 0))
        .map((tie) => ranked(tie.winnerClubId!));
      pairs = nextRoundPairings(winners);
    }

    const next = await this.createRound(worldId, competitionId, NEXT_STAGE[round], pairs, userId, {
      singleLeg: competition?.type === "INTERNATIONAL",
    });
    return { resolvedRound: round, resolvedTies, next };
  }

  async getBracket(worldId: string, competitionId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const ties = await this.withScores(await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId } }));
    return ties.sort((a, b) => KNOCKOUT_STAGES.indexOf(a.round) - KNOCKOUT_STAGES.indexOf(b.round));
  }

  /** Attaches each tie's aggregate score (from the tie's own home/away perspective) so the bracket
      can show results — it used to show only "WON"/"PENS" chips with no scoreline, even for the Final. */
  private async withScores<T extends { homeClubId: string; awayClubId: string; firstLegFixtureId: string | null; secondLegFixtureId: string | null }>(
    ties: T[],
  ): Promise<(T & { score: ReturnType<typeof aggregateTieScore> })[]> {
    const legIds = ties.flatMap((t) => [t.firstLegFixtureId, t.secondLegFixtureId]).filter((id): id is string => id !== null);
    const fixtures = legIds.length
      ? await this.prisma.fixture.findMany({ where: { id: { in: legIds } }, include: { match: { select: { homeScore: true, awayScore: true } } } })
      : [];
    const legById = new Map<string, PlayedLeg>();
    for (const f of fixtures) {
      if (!f.match) continue;
      legById.set(f.id, { homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeScore: f.match.homeScore, awayScore: f.match.awayScore });
    }
    return ties.map((tie) => {
      const legs = [tie.firstLegFixtureId, tie.secondLegFixtureId]
        .map((id) => (id ? legById.get(id) : undefined))
        .filter((leg): leg is PlayedLeg => leg !== undefined);
      return { ...tie, score: aggregateTieScore(tie, legs) };
    });
  }

  /** League-phase table — same shape as the domestic one, scoped to the clubs in this season. */
  async getLeaguePhaseStandings(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    return this.computeStandings(worldId, seasonId);
  }

  // ---- Building the field ---------------------------------------------------------------------

  /** The league this world is played in: the stored one, else the one most AI clubs come from. */
  private async resolveDomesticLeague(world: {
    settings: unknown;
    clubs: { refClubSeasonId: string | null; managedByUserId: string | null }[];
  }): Promise<{ id: string; country: string } | null> {
    let leagueId = (world.settings as { leagueId?: string } | null)?.leagueId ?? null;
    if (!leagueId) {
      const ids = world.clubs.filter((c) => !c.managedByUserId && c.refClubSeasonId).map((c) => c.refClubSeasonId!);
      const rows = ids.length
        ? await this.prisma.refClubSeason.findMany({ where: { id: { in: ids } }, select: { leagueId: true } })
        : [];
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.leagueId, (counts.get(r.leagueId) ?? 0) + 1);
      leagueId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
    if (!leagueId) return null;
    const league = await this.prisma.refLeague.findUnique({ where: { id: leagueId }, select: { id: true, country: true } });
    return league;
  }

  /**
   * Instantiates the strongest current clubs of every other real league into the world and returns
   * their world-club ids. "Current" is each league's most recent season in the dataset; a club the
   * user already fields (a squad-first draft of a real club-season) is never added a second time.
   */
  private async addForeignClubs(
    world: { id: string; eraId: string; clubs: { refClubSeasonId: string | null }[] },
    domesticLeagueId: string | null,
    window: { skip: number; take: number } = { skip: 0, take: FOREIGN_QUALIFIERS },
  ): Promise<string[]> {
    const leagues = await this.prisma.refLeague.findMany({
      where: { eraId: world.eraId, country: { in: REAL_LEAGUE_COUNTRIES }, ...(domesticLeagueId ? { id: { not: domesticLeagueId } } : {}) },
      select: { id: true },
    });
    if (leagues.length === 0) return [];

    const usedSeasonIds = world.clubs.map((c) => c.refClubSeasonId).filter((id): id is string => id !== null);
    const usedClubs = usedSeasonIds.length
      ? await this.prisma.refClubSeason.findMany({ where: { id: { in: usedSeasonIds } }, select: { clubId: true } })
      : [];
    const usedClubIds = new Set(usedClubs.map((c) => c.clubId));

    const picks = await Promise.all(
      leagues.map(async ({ id: leagueId }) => {
        const latest = await this.prisma.refClubSeason.aggregate({ where: { leagueId }, _max: { seasonYear: true } });
        if (latest._max.seasonYear == null) return [];
        const clubSeasons = await this.prisma.refClubSeason.findMany({
          where: { leagueId, seasonYear: latest._max.seasonYear },
          select: {
            id: true,
            clubId: true,
            club: { select: { name: true } },
            playerSeasons: { select: { id: true, positions: true, overall: true } },
          },
        });
        const seen = new Set<string>();
        return clubSeasons
          .filter((c) => {
            if (usedClubIds.has(c.clubId) || seen.has(c.clubId)) return false;
            seen.add(c.clubId);
            return true;
          })
          .map((c) => ({ ...c, strength: squadStrength(c.playerSeasons.map((p) => p.overall)) }))
          .sort((a, b) => b.strength - a.strength || a.clubId.localeCompare(b.clubId))
          .slice(window.skip, window.skip + window.take);
      }),
    );

    const managerIds = (await this.prisma.refManager.findMany({ select: { id: true } })).map((m) => m.id);
    const chosen = picks.flat();
    const created: string[] = [];
    // A few at a time: each club is a read plus a small transaction, so running all ~28 at once
    // would queue behind the connection pool rather than finish sooner.
    for (let i = 0; i < chosen.length; i += 10) {
      const batch = await Promise.all(
        chosen.slice(i, i + 10).map((clubSeason) => {
          const draftPool: DraftCandidate[] = clubSeason.playerSeasons.map((ps) => ({
            refPlayerSeasonId: ps.id,
            positions: ps.positions as Position[],
            overall: ps.overall,
          }));
          return instantiateWorldClub(this.prisma, {
            worldId: world.id,
            name: clubSeason.club.name,
            refClubSeasonId: clubSeason.id,
            managedByUserId: undefined,
            formation: AI_CLUB_FORMATION,
            lineup: buildLineup(AI_CLUB_FORMATION, draftPool),
            allPlayerSeasonIds: clubSeason.playerSeasons.map((p) => p.id),
            refManagerId: managerIds.length > 0 ? managerIds[randomInt(managerIds.length)] : undefined,
          });
        }),
      );
      created.push(...batch.map((c) => c.id));
    }
    return created;
  }

  /** Country and squad strength for each club, read from the world itself so the seeding is the same
      whether it's computed when the draw is made or rebuilt later. */
  private async entrantsFor(worldId: string, clubIds: string[], domesticCountry: string): Promise<Entrant[]> {
    const [clubs, players] = await Promise.all([
      this.prisma.worldClub.findMany({
        where: { id: { in: clubIds }, worldId },
        select: {
          id: true,
          managedByUserId: true,
          refClubSeason: { select: { league: { select: { country: true } } } },
        },
      }),
      this.prisma.worldPlayer.findMany({ where: { clubId: { in: clubIds } }, select: { clubId: true, overall: true } }),
    ]);
    const overallsByClub = new Map<string, number[]>();
    for (const p of players) {
      const list = overallsByClub.get(p.clubId) ?? [];
      list.push(p.overall);
      overallsByClub.set(p.clubId, list);
    }
    return clubs.map((c) => ({
      clubId: c.id,
      // The user's own club plays in the chosen league even if its drafted squad came from elsewhere.
      country: c.managedByUserId ? domesticCountry : (c.refClubSeason?.league.country ?? domesticCountry),
      strength: squadStrength(overallsByClub.get(c.id) ?? []),
    }));
  }

  private async buildDraw(worldId: string, leaguePhaseSeasonId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);
    const fixtures = await this.prisma.fixture.findMany({ where: { worldId, seasonId: leaguePhaseSeasonId } });
    const clubIds = [...new Set(fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))];
    const domesticLeague = await this.resolveDomesticLeague(world);
    const entrants = await this.entrantsFor(worldId, clubIds, domesticLeague?.country ?? "Home");
    const nameById = new Map(world.clubs.map((c) => [c.id, c.name]));
    const seeded = seedEntrants(entrants);
    return {
      clubs: seeded.map((s) => ({
        clubId: s.clubId,
        name: nameById.get(s.clubId) ?? "Unknown",
        country: s.country,
        seed: s.seed,
        pot: s.pot,
        strength: Math.round(s.strength),
      })),
    };
  }

  // ---- Knockout rounds ------------------------------------------------------------------------

  /**
   * Creates one knockout round — a fresh Season, the fixtures and the ties — and queues it. Two legs
   * per tie (the weaker seed hosts the first) except the Final and any `singleLeg` round (the Nations
   * Cup, played at neutral venues). Public so the Nations Cup can reuse it.
   */
  async createRound(
    worldId: string,
    competitionId: string,
    round: KnockoutStage,
    pairs: Pairing[],
    userId: string,
    options: { singleLeg?: boolean } = {},
  ) {
    const season = await this.prisma.season.create({
      data: { worldId, competitionId, year: new Date().getFullYear(), status: "SCHEDULED" },
    });

    const isFinal = round === "FINAL" || options.singleLeg === true;
    // Each tie is independent, so they're written side by side; nothing depends on creation order
    // (the bracket is recovered from the clubs — see bracketOrder).
    const ties = await Promise.all(
      pairs.map(async ([stronger, weaker]) => {
        const [firstLeg, secondLeg] = await Promise.all([
          this.prisma.fixture.create({
            data: {
              worldId,
              seasonId: season.id,
              matchday: 1,
              homeClubId: isFinal ? stronger.clubId : weaker.clubId,
              awayClubId: isFinal ? weaker.clubId : stronger.clubId,
              status: "SCHEDULED",
            },
          }),
          isFinal
            ? Promise.resolve(null)
            : this.prisma.fixture.create({
                data: {
                  worldId,
                  seasonId: season.id,
                  matchday: 2,
                  homeClubId: stronger.clubId,
                  awayClubId: weaker.clubId,
                  status: "SCHEDULED",
                },
              }),
        ]);
        return this.prisma.knockoutTie.create({
          data: {
            worldId,
            competitionId,
            round,
            homeClubId: stronger.clubId,
            awayClubId: weaker.clubId,
            firstLegFixtureId: firstLeg.id,
            secondLegFixtureId: secondLeg?.id ?? null,
          },
        });
      }),
    );

    await this.seasons.requestSimulation(worldId, season.id, userId);
    return { round, seasonId: season.id, ties };
  }

  /** Winner-take-all resolution for one tie: aggregate score, falling back to a penalty shootout if level. */
  private async resolveTie(tie: { id: string; homeClubId: string; awayClubId: string; firstLegFixtureId: string | null; secondLegFixtureId: string | null }) {
    const legIds = [tie.firstLegFixtureId, tie.secondLegFixtureId].filter((id): id is string => id !== null);
    const legs = await this.prisma.fixture.findMany({ where: { id: { in: legIds } }, include: { match: { select: { homeScore: true, awayScore: true } } } });

    let homeAgg = 0;
    let awayAgg = 0;
    for (const leg of legs) {
      if (!leg.match) continue;
      const homeIsTieHome = leg.homeClubId === tie.homeClubId;
      homeAgg += homeIsTieHome ? leg.match.homeScore : leg.match.awayScore;
      awayAgg += homeIsTieHome ? leg.match.awayScore : leg.match.homeScore;
    }

    let winnerClubId: string;
    let wentToPenalties = false;
    if (homeAgg !== awayAgg) {
      winnerClubId = homeAgg > awayAgg ? tie.homeClubId : tie.awayClubId;
    } else {
      wentToPenalties = true;
      winnerClubId = await this.resolvePenalties(tie.homeClubId, tie.awayClubId);
    }

    return this.prisma.knockoutTie.update({
      where: { id: tie.id },
      data: { winnerClubId, wentToPenalties },
    });
  }

  /**
   * Not a full penalty-by-penalty simulation (out of scope) — a single weighted coin flip, nudged
   * by each side's average squad quality, using the same crypto RNG pattern already used elsewhere
   * in this service layer (e.g. SeasonsService's AI manager assignment) for genuine per-call randomness.
   */
  private async resolvePenalties(homeClubId: string, awayClubId: string): Promise<string> {
    const [homeAvg, awayAvg] = await Promise.all([this.averageOverall(homeClubId), this.averageOverall(awayClubId)]);
    const diff = Math.max(-15, Math.min(15, homeAvg - awayAvg));
    const homeWinChance = 0.5 + diff / 100;
    return randomInt(10000) / 10000 < homeWinChance ? homeClubId : awayClubId;
  }

  private async averageOverall(clubId: string): Promise<number> {
    const result = await this.prisma.worldPlayer.aggregate({ where: { clubId }, _avg: { overall: true } });
    return result._avg.overall ?? 70;
  }

  // ---- Tables ---------------------------------------------------------------------------------

  /** Standings for every club that has a fixture in this season, computed from completed results. */
  private async computeStandings(worldId: string, seasonId: string) {
    const fixtures = await this.prisma.fixture.findMany({
      where: { worldId, seasonId },
      include: { match: { select: { homeScore: true, awayScore: true } } },
    });
    const clubIds = [...new Set(fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))];
    const results: CompletedResult[] = fixtures
      .filter((f): f is typeof f & { match: NonNullable<(typeof f)["match"]> } => f.match !== null)
      .map((f) => ({
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeScore: f.match.homeScore,
        awayScore: f.match.awayScore,
      }));
    return buildStandings(seasonId, clubIds, results);
  }

  /** The league-phase table as 1-based ranks. */
  private async rankedTable(worldId: string, seasonId: string): Promise<RankedClub[]> {
    const standings = await this.computeStandings(worldId, seasonId);
    return standings.rows.map((row, i) => ({ clubId: row.clubId, rank: i + 1 }));
  }

  /** The Continental Cup has no league phase: its seeds are its clubs ranked by squad strength. */
  private async cupSeedTable(worldId: string, competitionId: string): Promise<RankedClub[]> {
    const ties = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId, round: "R16" } });
    const entrants = await this.entrantsFor(worldId, ties.flatMap((t) => [t.homeClubId, t.awayClubId]), "Home");
    return seedEntrants(entrants).map((s) => ({ clubId: s.clubId, rank: s.seed }));
  }

  /** The competition's own league-phase table — its first season, which seeds every knockout round. */
  private async leaguePhaseTable(worldId: string, competitionId: string): Promise<RankedClub[]> {
    const leaguePhaseSeason = await this.prisma.season.findFirst({
      where: { worldId, competitionId },
      orderBy: { createdAt: "asc" },
    });
    if (!leaguePhaseSeason) return [];
    return this.rankedTable(worldId, leaguePhaseSeason.id);
  }
}
