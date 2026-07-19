import { PrismaClient, type Prisma } from "@prisma/client";
import { createRng } from "@futbol/engine";
import { generateAttributes } from "@futbol/engine/testing";

/**
 * Seeds a broader, clearly-fictional placeholder reference dataset — several
 * leagues across several countries, several clubs each, several seasons per
 * club — so the multi-league picker and the spin-the-wheel draft have real
 * variety to work with. This is NOT the real historical player-season
 * dataset described in the architecture doc (open question: which
 * licensed/open dataset to import) — swapping it in later is a data/ETL
 * job, not a schema or engine change.
 *
 * Batched via createMany (skipDuplicates) instead of thousands of
 * sequential per-row upserts — this dataset is a few thousand rows and
 * round-tripping each one individually to a remote Postgres instance is
 * prohibitively slow. skipDuplicates makes reruns (including resuming a
 * previously-interrupted seed) safe without needing per-row upsert.
 */

const prisma = new PrismaClient();

const STARTING_POSITIONS = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"];
const BENCH_POSITIONS = ["GK", "CB", "LB", "RB", "CM", "CAM", "ST"];
const ALL_POSITIONS = [...STARTING_POSITIONS, ...BENCH_POSITIONS];

const ERA = { id: "era-all-time", name: "All-Time", startYear: 1992, endYear: 2025 };

/** Spread of season years each club can be drafted from, within the era's range. */
const SEASON_YEAR_POOL = [1996, 2002, 2008, 2013, 2018, 2023];

interface LeagueSeed {
  id: string;
  name: string;
  country: string;
  tier: number;
  clubs: Array<{ name: string; reputation: number }>;
}

const LEAGUES: LeagueSeed[] = [
  {
    id: "league-ironbridge-premier",
    name: "Ironbridge Premier",
    country: "Fictionland",
    tier: 1,
    clubs: [
      { name: "Ironbridge United", reputation: 84 },
      { name: "Riverside Athletic", reputation: 79 },
      { name: "Harborview FC", reputation: 75 },
      { name: "Kingsgate Town", reputation: 72 },
      { name: "Millbrook Rovers", reputation: 70 },
      { name: "Eastcliff City", reputation: 68 },
    ],
  },
  {
    id: "league-fictionland-championship",
    name: "Fictionland Championship",
    country: "Fictionland",
    tier: 2,
    clubs: [
      { name: "Westgate Wanderers", reputation: 64 },
      { name: "Blackfen Albion", reputation: 62 },
      { name: "Stonebridge United", reputation: 60 },
      { name: "Fenwick Town", reputation: 58 },
      { name: "Ashfield Rovers", reputation: 57 },
      { name: "Dockside FC", reputation: 55 },
    ],
  },
  {
    id: "league-nordholm-superliga",
    name: "Nordholm Superliga",
    country: "Nordholm",
    tier: 1,
    clubs: [
      { name: "Nordvik SK", reputation: 82 },
      { name: "Solheim IF", reputation: 77 },
      { name: "Bjornstad United", reputation: 74 },
      { name: "Fjordly City", reputation: 71 },
      { name: "Kastvik Athletic", reputation: 69 },
      { name: "Lindoy FK", reputation: 66 },
    ],
  },
  {
    id: "league-nordholm-first-division",
    name: "Nordholm First Division",
    country: "Nordholm",
    tier: 2,
    clubs: [
      { name: "Ravnfjell IF", reputation: 63 },
      { name: "Torghall United", reputation: 61 },
      { name: "Myrdal SK", reputation: 59 },
      { name: "Isbrekke FC", reputation: 57 },
      { name: "Gronvik Athletic", reputation: 56 },
      { name: "Sandoy Rovers", reputation: 54 },
    ],
  },
  {
    id: "league-meridia-primera",
    name: "Meridia Primera",
    country: "Meridia",
    tier: 1,
    clubs: [
      { name: "Aurelia CF", reputation: 85 },
      { name: "Costa Marina", reputation: 78 },
      { name: "Valdoro United", reputation: 75 },
      { name: "Sierra Alta FC", reputation: 72 },
      { name: "Puerto Rojo", reputation: 70 },
      { name: "Del Sol Athletic", reputation: 67 },
    ],
  },
  {
    id: "league-solberg-elite",
    name: "Solberg Elite",
    country: "Solberg",
    tier: 1,
    clubs: [
      { name: "Solberg SC", reputation: 80 },
      { name: "Nordkraft FC", reputation: 76 },
      { name: "Vindheim United", reputation: 73 },
      { name: "Falkeby Athletic", reputation: 70 },
      { name: "Storasen IK", reputation: 68 },
      { name: "Brekkevik FC", reputation: 65 },
    ],
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main(): Promise<void> {
  console.log("Seeding reference data (broad fictional multi-league dataset)...");

  await prisma.era.upsert({
    where: { id: ERA.id },
    update: { name: ERA.name, startYear: ERA.startYear, endYear: ERA.endYear },
    create: ERA,
  });

  for (const leagueSeed of LEAGUES) {
    await prisma.refLeague.upsert({
      where: { id: leagueSeed.id },
      update: { name: leagueSeed.name, country: leagueSeed.country, tier: leagueSeed.tier, eraId: ERA.id },
      create: {
        id: leagueSeed.id,
        eraId: ERA.id,
        name: leagueSeed.name,
        country: leagueSeed.country,
        tier: leagueSeed.tier,
      },
    });
  }
  console.log(`Upserted ${LEAGUES.length} leagues.`);

  const rng = createRng(1n);

  const clubRows: Prisma.RefClubCreateManyInput[] = [];
  const clubSeasonRows: Prisma.RefClubSeasonCreateManyInput[] = [];
  const playerRows: Prisma.RefPlayerCreateManyInput[] = [];
  const playerSeasonRows: Prisma.RefPlayerSeasonCreateManyInput[] = [];

  for (const leagueSeed of LEAGUES) {
    for (let clubIndex = 0; clubIndex < leagueSeed.clubs.length; clubIndex++) {
      const clubSeed = leagueSeed.clubs[clubIndex]!;
      const clubId = `club-${slugify(leagueSeed.id)}-${slugify(clubSeed.name)}`;

      clubRows.push({ id: clubId, name: clubSeed.name, country: leagueSeed.country });

      const seasonYears = [
        SEASON_YEAR_POOL[clubIndex % SEASON_YEAR_POOL.length]!,
        SEASON_YEAR_POOL[(clubIndex + 3) % SEASON_YEAR_POOL.length]!,
      ];

      const quality = clubSeed.reputation / 100;

      for (const seasonYear of seasonYears) {
        const clubSeasonId = `${clubId}-${seasonYear}`;
        clubSeasonRows.push({
          id: clubSeasonId,
          clubId,
          seasonYear,
          leagueId: leagueSeed.id,
          reputation: clubSeed.reputation,
        });

        for (let i = 0; i < ALL_POSITIONS.length; i++) {
          const position = ALL_POSITIONS[i];
          const playerId = `${clubId}-${seasonYear}-p${i + 1}`;

          playerRows.push({
            id: playerId,
            name: `${clubSeed.name} Player ${i + 1}`,
            nationality: leagueSeed.country,
            dateOfBirth: new Date(seasonYear - 18 - Math.floor(rng() * 14), 0, 1),
          });

          playerSeasonRows.push({
            id: `${playerId}-season`,
            playerId,
            clubSeasonId,
            seasonYear,
            positions: [position ?? "CM"],
            preferredFoot: rng() < 0.75 ? "right" : "left",
            weakFoot: 1 + Math.floor(rng() * 5),
            attributes: generateAttributes(rng, quality + (rng() - 0.5) * 0.1) as unknown as Prisma.InputJsonValue,
            overall: Math.round(quality * 99),
            potential: Math.min(99, Math.round(quality * 99) + Math.floor(rng() * 8)),
            traits: [],
          });
        }
      }
    }
  }

  const clubIds = clubRows.map((c) => c.id!);

  // Clean up any club-seasons left over from an earlier interrupted run of this
  // script (pre-batching it briefly auto-generated clubSeason ids instead of the
  // deterministic ones used below, which would otherwise collide on the
  // (clubId, seasonYear) unique constraint and orphan the player-seasons FK).
  await prisma.refPlayerSeason.deleteMany({ where: { clubSeason: { clubId: { in: clubIds } } } });
  await prisma.refClubSeason.deleteMany({ where: { clubId: { in: clubIds } } });

  await prisma.refClub.createMany({ data: clubRows, skipDuplicates: true });
  console.log(`Inserted ${clubRows.length} clubs.`);

  await prisma.refClubSeason.createMany({ data: clubSeasonRows, skipDuplicates: true });
  console.log(`Inserted ${clubSeasonRows.length} club-seasons.`);

  await prisma.refPlayer.createMany({ data: playerRows, skipDuplicates: true });
  console.log(`Inserted ${playerRows.length} players.`);

  await prisma.refPlayerSeason.createMany({ data: playerSeasonRows, skipDuplicates: true });
  console.log(`Inserted ${playerSeasonRows.length} player-seasons.`);

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
