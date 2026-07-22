import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@futbol/db";
import { simulate } from "@futbol/engine";
import { matchSetup as matchSetupSchema, tactics as tacticsSchema, type SeasonSimJob, type Tactics } from "@futbol/domain";
import { buildSquad, type WorldClubRow, type WorldPlayerRow } from "./build-squad.js";

const DEFAULT_TACTICS = tacticsSchema.parse({});

interface RefManagerRow {
  mentality: string;
  tempo: string;
  width: string;
  pressing: string;
  passingStyle: string;
}

/** Falls back to DEFAULT_TACTICS for manager-less clubs (e.g. the user declined a manager). */
function tacticsForManager(manager: RefManagerRow | null): Tactics {
  if (!manager) return DEFAULT_TACTICS;
  return tacticsSchema.parse({
    mentality: manager.mentality,
    tempo: manager.tempo,
    width: manager.width,
    pressing: manager.pressing,
    passingStyle: manager.passingStyle,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pure boundary check for the January Transfer Window's matchday cutoff — kept separate from the
    loop in processSeasonSimJob so the `<=` boundary is unit-testable without mocking Prisma. */
export function shouldSimulateMatchday(matchday: number, throughMatchday: number | undefined): boolean {
  return throughMatchday === undefined || matchday <= throughMatchday;
}

function randomSeed(): bigint {
  return BigInt(`0x${randomBytes(8).toString("hex")}`);
}

function toWorldClubRow(club: { id: string; worldId: string; name: string; formation: string | null; lineup: unknown; bench: unknown }): WorldClubRow {
  return club;
}

interface ClubWithManager {
  id: string;
  worldId: string;
  name: string;
  formation: string | null;
  lineup: unknown;
  bench: unknown;
  refManager: RefManagerRow | null;
}

interface MutablePlayerRow extends WorldPlayerRow {
  clubId: string;
}

interface MatchdayFixtureResult {
  fixtureId: string;
  matchId: string;
  fitness: { playerId: string; fitness: number }[];
}

/**
 * Simulates and persists one fixture: pure in-memory `simulate()` call, then one small transaction
 * (match + its events + its stats — 3 statements). Independent fixtures within a matchday run
 * concurrently via Promise.all in simulateMatchday below, which is what actually matters against a
 * remote/pooled Postgres: round-trip latency dominates, and running N matches' transactions on N
 * pooled connections at once hides that latency behind parallelism. (A prior version collapsed an
 * entire matchday into one big sequential transaction to cut total statement count — 3 bulk
 * createMany calls instead of ~30 — but that traded away the cross-match parallelism and was
 * measured *slower* overall: ~74-84s instead of ~24s for a 380-fixture season, because one match's
 * worth of round trips run one-at-a-time is still faster wall-clock than ten matches' worth run
 * back-to-back on a single connection.)
 */
async function simulateFixture(
  prisma: PrismaClient,
  worldId: string,
  fixture: { id: string; homeClubId: string; awayClubId: string },
  clubById: Map<string, ClubWithManager>,
  playersByClub: Map<string, MutablePlayerRow[]>,
  playerById: Map<string, MutablePlayerRow>,
  isFinal: boolean,
  isContinental: boolean,
): Promise<MatchdayFixtureResult> {
  const homeClub = clubById.get(fixture.homeClubId)!;
  const awayClub = clubById.get(fixture.awayClubId)!;
  const homeTactics = tacticsForManager(homeClub.refManager);
  const awayTactics = tacticsForManager(awayClub.refManager);
  const homePlayers = playersByClub.get(homeClub.id) ?? [];
  const awayPlayers = playersByClub.get(awayClub.id) ?? [];

  const homeSquad = buildSquad(toWorldClubRow(homeClub), homePlayers);
  const awaySquad = buildSquad(toWorldClubRow(awayClub), awayPlayers);

  const setup = matchSetupSchema.parse({
    matchId: fixture.id,
    worldId,
    home: { clubId: homeClub.id, squad: homeSquad, tactics: homeTactics, isHome: true },
    away: { clubId: awayClub.id, squad: awaySquad, tactics: awayTactics, isHome: false },
    weather: "clear",
    importance: isFinal ? "final" : isContinental ? "cup" : "league",
    neutralVenue: isFinal,
    rivalryIntensity: 0,
  });

  const seed = randomSeed();
  const result = simulate(setup, seed);
  const matchId = randomUUID();

  await prisma.$transaction([
    prisma.match.create({
      data: {
        id: matchId,
        worldId,
        setup: setup as unknown as object,
        seed: result.seed,
        engineVersion: result.engineVersion,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        homeXg: result.homeXg,
        awayXg: result.awayXg,
        homePossession: result.homePossession,
        awayPossession: result.awayPossession,
      },
    }),
    prisma.matchEvent.createMany({
      data: result.events.map((event) => ({
        matchId,
        seq: event.seq,
        minute: event.minute,
        type: event.type,
        payload: event as unknown as object,
      })),
    }),
    prisma.playerMatchStat.createMany({
      data: result.playerStats.map((stat) => ({
        matchId,
        playerId: stat.playerId,
        rating: stat.rating,
        goals: stat.goals,
        assists: stat.assists,
        shots: stat.shots,
        passesCompleted: stat.passesCompleted,
        tackles: stat.tackles,
        minutesPlayed: stat.minutesPlayed,
      })),
    }),
  ]);

  // In-memory fitness update happens now (so the next matchday's squad build sees it without a
  // re-read); the DB write is batched with the rest of the matchday's in simulateMatchday.
  const fitness: { playerId: string; fitness: number }[] = [];
  for (const stat of result.playerStats) {
    if (stat.minutesPlayed <= 0) continue;
    const value = clamp(1 - (stat.minutesPlayed / 90) * 0.2, 0.6, 1);
    const player = playerById.get(stat.playerId);
    if (player) player.fitness = value;
    fitness.push({ playerId: stat.playerId, fitness: value });
  }

  return { fixtureId: fixture.id, matchId, fitness };
}

/** Runs every fixture in one matchday concurrently (see simulateFixture), then persists the whole
    matchday's fixture-status and fitness updates as two single raw `CASE` UPDATEs instead of N
    concurrent `prisma.*.update()` calls — for a 10-match matchday that's ~150-200 simultaneous
    update requests, enough to genuinely contend for Prisma's connection pool. */
async function simulateMatchday(
  prisma: PrismaClient,
  worldId: string,
  dayFixtures: { id: string; homeClubId: string; awayClubId: string }[],
  clubById: Map<string, ClubWithManager>,
  playersByClub: Map<string, MutablePlayerRow[]>,
  finalFixtureIds: Set<string>,
  isContinental: boolean,
): Promise<void> {
  const playerById = new Map<string, MutablePlayerRow>();
  for (const players of playersByClub.values()) {
    for (const player of players) playerById.set(player.id, player);
  }

  const results = await Promise.all(
    dayFixtures.map((fixture) =>
      simulateFixture(prisma, worldId, fixture, clubById, playersByClub, playerById, finalFixtureIds.has(fixture.id), isContinental),
    ),
  );

  await batchUpdateFixtureStatus(
    prisma,
    results.map((r) => ({ fixtureId: r.fixtureId, matchId: r.matchId })),
  );
  await batchUpdateFitness(prisma, results.flatMap((r) => r.fitness));
}

async function batchUpdateFixtureStatus(
  prisma: PrismaClient,
  updates: { fixtureId: string; matchId: string }[],
): Promise<void> {
  if (updates.length === 0) return;
  const cases = Prisma.join(
    updates.map((u) => Prisma.sql`WHEN ${u.fixtureId} THEN ${u.matchId}`),
    " ",
  );
  const ids = Prisma.join(updates.map((u) => u.fixtureId));
  await prisma.$executeRaw`UPDATE "fixtures" SET status = 'COMPLETED', "matchId" = CASE id ${cases} END WHERE id IN (${ids})`;
}

async function batchUpdateFitness(prisma: PrismaClient, updates: { playerId: string; fitness: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const cases = Prisma.join(
    updates.map((u) => Prisma.sql`WHEN ${u.playerId} THEN ${u.fitness}`),
    " ",
  );
  const ids = Prisma.join(updates.map((u) => u.playerId));
  await prisma.$executeRaw`UPDATE "world_players" SET fitness = CASE id ${cases} END WHERE id IN (${ids})`;
}

/**
 * Consumes one season-simulation job: simulates every still-scheduled fixture
 * via the deterministic engine, persists the match/events/stats, applies a
 * light post-match fitness dip, and marks the season complete once every
 * fixture has a result. Morale/form progression between matches is
 * intentionally out of scope here — that's Phase 3 (club management) per the
 * roadmap; this worker only proves the sim pipeline.
 *
 * Clubs/players are loaded once up front (not re-fetched per fixture), and fixtures are simulated
 * matchday-by-matchday with every fixture in a matchday persisted concurrently (see
 * simulateMatchday/simulateFixture) — no club appears twice in the same matchday, so there's no
 * write conflict. Against a remote/pooled Postgres, the original one-fixture-at-a-time loop with a
 * fresh club/squad re-fetch per fixture took 15-20+ minutes for a 380-fixture season (the same
 * round-trip-latency trap already hit once in `fillAiClubs` — see CLAUDE.md). Matchday-level
 * concurrency plus batching the fixture-status/fitness updates into two raw SQL statements per
 * matchday (instead of one per row) brings a 380-fixture season down to roughly 60-90s in practice
 * against Neon's shared free-tier compute — measured across several structural variants (a single
 * giant transaction per matchday, capped-concurrency updates, a larger Prisma connection pool),
 * none of which moved this floor much, so remaining time is dominated by remote round-trip latency
 * itself rather than anything fixable from here without a lower-latency/self-hosted DB.
 */
export async function processSeasonSimJob(prisma: PrismaClient, job: SeasonSimJob): Promise<void> {
  const { worldId, seasonId, throughMatchday } = job;

  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { competition: true } });
  const isContinental = season.competition.type === "CONTINENTAL";

  // The Champions League Final is a single neutral-venue match — every other continental fixture
  // (league phase + two-legged knockout ties) is "cup" importance, domestic fixtures stay "league".
  const finalFixtureIds = new Set<string>();
  if (isContinental) {
    const finalTies = await prisma.knockoutTie.findMany({
      where: { worldId, competitionId: season.competitionId, round: "FINAL" },
    });
    for (const tie of finalTies) {
      if (tie.firstLegFixtureId) finalFixtureIds.add(tie.firstLegFixtureId);
      if (tie.secondLegFixtureId) finalFixtureIds.add(tie.secondLegFixtureId);
    }
  }

  const fixtures = await prisma.fixture.findMany({
    where: { worldId, seasonId, status: "SCHEDULED" },
    orderBy: { matchday: "asc" },
  });

  if (fixtures.length > 0) {
    const clubIds = [...new Set(fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))];
    const clubs = await prisma.worldClub.findMany({ where: { id: { in: clubIds } }, include: { refManager: true } });
    const clubById = new Map(clubs.map((c) => [c.id, c as ClubWithManager]));

    const players = await prisma.worldPlayer.findMany({ where: { clubId: { in: clubIds } } });
    const playersByClub = new Map<string, MutablePlayerRow[]>();
    for (const player of players as unknown as MutablePlayerRow[]) {
      const list = playersByClub.get(player.clubId) ?? [];
      list.push(player);
      playersByClub.set(player.clubId, list);
    }

    const fixturesByMatchday = new Map<number, typeof fixtures>();
    for (const fixture of fixtures) {
      const list = fixturesByMatchday.get(fixture.matchday) ?? [];
      list.push(fixture);
      fixturesByMatchday.set(fixture.matchday, list);
    }

    for (const matchday of [...fixturesByMatchday.keys()].sort((a, b) => a - b)) {
      // The January Transfer Window pause: stop simulating once past the requested matchday and
      // leave the rest SCHEDULED. `remaining` below will be nonzero, so the Season stays IN_PROGRESS
      // rather than COMPLETED — a later job with no throughMatchday picks up where this left off,
      // reading whatever WorldClub/WorldPlayer changes were made to the roster in between.
      if (!shouldSimulateMatchday(matchday, throughMatchday)) break;
      const dayFixtures = fixturesByMatchday.get(matchday)!;
      await simulateMatchday(prisma, worldId, dayFixtures, clubById, playersByClub, finalFixtureIds, isContinental);
    }
  }

  const remaining = await prisma.fixture.count({
    where: { worldId, seasonId, status: { not: "COMPLETED" } },
  });
  if (remaining === 0) {
    await prisma.season.update({ where: { id: seasonId }, data: { status: "COMPLETED" } });
  }
}
