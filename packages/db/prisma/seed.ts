import { PrismaClient } from "@prisma/client";
import { createRng } from "@futbol/engine";
import { generateAttributes } from "@futbol/engine/testing";

/**
 * Seeds a small, clearly-fictional placeholder reference dataset so the
 * draft -> season -> share pipeline can be exercised end-to-end. This is
 * NOT the real historical player-season dataset described in the
 * architecture doc (open question: which licensed/open dataset to import) —
 * swapping it in later is a data/ ETL job, not a schema or engine change.
 */

const prisma = new PrismaClient();

const STARTING_POSITIONS = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"];
const BENCH_POSITIONS = ["GK", "CB", "LB", "RB", "CM", "CAM", "ST"];

const CLUBS = [
  { id: "club-ironbridge", name: "Ironbridge United", country: "Fictionland", reputation: 78 },
  { id: "club-riverside", name: "Riverside Athletic", country: "Fictionland", reputation: 74 },
];

async function main(): Promise<void> {
  console.log("Seeding sample reference data (placeholder dataset)...");

  const era = await prisma.era.upsert({
    where: { id: "era-2000s" },
    update: {},
    create: { id: "era-2000s", name: "2000-2010", startYear: 2000, endYear: 2010 },
  });

  const league = await prisma.refLeague.upsert({
    where: { id: "league-sample-top-flight" },
    update: {},
    create: {
      id: "league-sample-top-flight",
      eraId: era.id,
      name: "Sample Top Flight",
      country: "Fictionland",
      tier: 1,
    },
  });

  const rng = createRng(1n);
  const seasonYear = 2005;
  const allPositions = [...STARTING_POSITIONS, ...BENCH_POSITIONS];

  for (const clubSeed of CLUBS) {
    const club = await prisma.refClub.upsert({
      where: { id: clubSeed.id },
      update: {},
      create: { id: clubSeed.id, name: clubSeed.name, country: clubSeed.country },
    });

    const clubSeason = await prisma.refClubSeason.upsert({
      where: { clubId_seasonYear: { clubId: club.id, seasonYear } },
      update: {},
      create: {
        clubId: club.id,
        seasonYear,
        leagueId: league.id,
        reputation: clubSeed.reputation,
      },
    });

    const quality = clubSeed.reputation / 100;

    for (let i = 0; i < allPositions.length; i++) {
      const position = allPositions[i];
      const playerId = `${clubSeed.id}-player-${i + 1}`;
      const player = await prisma.refPlayer.upsert({
        where: { id: playerId },
        update: {},
        create: {
          id: playerId,
          name: `${clubSeed.name} Player ${i + 1}`,
          nationality: clubSeed.country,
          dateOfBirth: new Date(1978 + Math.floor(rng() * 12), 0, 1),
        },
      });

      await prisma.refPlayerSeason.upsert({
        where: { id: `${playerId}-${seasonYear}` },
        update: {},
        create: {
          id: `${playerId}-${seasonYear}`,
          playerId: player.id,
          clubSeasonId: clubSeason.id,
          seasonYear,
          positions: [position ?? "CM"],
          preferredFoot: rng() < 0.75 ? "right" : "left",
          weakFoot: 1 + Math.floor(rng() * 5),
          attributes: generateAttributes(rng, quality + (rng() - 0.5) * 0.1),
          overall: Math.round(quality * 99),
          potential: Math.min(99, Math.round(quality * 99) + Math.floor(rng() * 8)),
          traits: [],
        },
      });
    }

    console.log(`Seeded ${clubSeed.name} ${seasonYear} with ${allPositions.length} player-seasons.`);
  }

  console.log("Done.");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
