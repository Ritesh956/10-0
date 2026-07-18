import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@futbol/db";
import { simulate } from "@futbol/engine";
import { matchSetup as matchSetupSchema, tactics as tacticsSchema, type SeasonSimJob } from "@futbol/domain";
import { buildSquad, type WorldClubRow, type WorldPlayerRow } from "./build-squad.js";

const DEFAULT_TACTICS = tacticsSchema.parse({});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomSeed(): bigint {
  return BigInt(`0x${randomBytes(8).toString("hex")}`);
}

function toWorldClubRow(club: { id: string; worldId: string; name: string; formation: string | null; lineup: unknown; bench: unknown }): WorldClubRow {
  return club;
}

/**
 * Consumes one season-simulation job: simulates every still-scheduled fixture
 * in matchday order via the deterministic engine, persists the match/events/
 * stats, applies a light post-match fitness dip, and marks the season
 * complete once every fixture has a result. Morale/form progression between
 * matches is intentionally out of scope here — that's Phase 3 (club
 * management) per the roadmap; this worker only proves the sim pipeline.
 */
export async function processSeasonSimJob(prisma: PrismaClient, job: SeasonSimJob): Promise<void> {
  const { worldId, seasonId } = job;

  const fixtures = await prisma.fixture.findMany({
    where: { worldId, seasonId, status: "SCHEDULED" },
    orderBy: { matchday: "asc" },
  });

  for (const fixture of fixtures) {
    const [homeClub, awayClub] = await Promise.all([
      prisma.worldClub.findUniqueOrThrow({ where: { id: fixture.homeClubId } }),
      prisma.worldClub.findUniqueOrThrow({ where: { id: fixture.awayClubId } }),
    ]);
    const [homePlayers, awayPlayers] = await Promise.all([
      prisma.worldPlayer.findMany({ where: { clubId: homeClub.id } }),
      prisma.worldPlayer.findMany({ where: { clubId: awayClub.id } }),
    ]);

    const homeSquad = buildSquad(toWorldClubRow(homeClub), homePlayers as unknown as WorldPlayerRow[]);
    const awaySquad = buildSquad(toWorldClubRow(awayClub), awayPlayers as unknown as WorldPlayerRow[]);

    const setup = matchSetupSchema.parse({
      matchId: fixture.id,
      worldId,
      home: { clubId: homeClub.id, squad: homeSquad, tactics: DEFAULT_TACTICS, isHome: true },
      away: { clubId: awayClub.id, squad: awaySquad, tactics: DEFAULT_TACTICS, isHome: false },
      weather: "clear",
      importance: "league",
      neutralVenue: false,
      rivalryIntensity: 0,
    });

    const seed = randomSeed();
    const result = simulate(setup, seed);

    await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
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
      });

      await tx.matchEvent.createMany({
        data: result.events.map((event) => ({
          matchId: match.id,
          seq: event.seq,
          minute: event.minute,
          type: event.type,
          payload: event as unknown as object,
        })),
      });

      await tx.playerMatchStat.createMany({
        data: result.playerStats.map((stat) => ({
          matchId: match.id,
          playerId: stat.playerId,
          rating: stat.rating,
          goals: stat.goals,
          assists: stat.assists,
          shots: stat.shots,
          passesCompleted: stat.passesCompleted,
          tackles: stat.tackles,
          minutesPlayed: stat.minutesPlayed,
        })),
      });

      await tx.fixture.update({
        where: { id: fixture.id },
        data: { status: "COMPLETED", matchId: match.id },
      });

      for (const stat of result.playerStats) {
        if (stat.minutesPlayed <= 0) continue;
        const fitness = clamp(1 - (stat.minutesPlayed / 90) * 0.2, 0.6, 1);
        await tx.worldPlayer.update({ where: { id: stat.playerId }, data: { fitness } });
      }
    });
  }

  const remaining = await prisma.fixture.count({
    where: { worldId, seasonId, status: { not: "COMPLETED" } },
  });
  if (remaining === 0) {
    await prisma.season.update({ where: { id: seasonId }, data: { status: "COMPLETED" } });
  }
}
