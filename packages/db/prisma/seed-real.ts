import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createRng } from "@futbol/engine";
import { generateAttributes } from "@futbol/engine/testing";

/**
 * Seeds the real reference-catalog dataset: top-5 European leagues (Premier
 * League, LaLiga, Serie A, Bundesliga, Ligue 1), seasons 2012-2024, built
 * from real player/club/appearance facts (names, positions, minutes, goals,
 * assists, market value) published by the dcaribou/transfermarkt-datasets
 * project (https://github.com/dcaribou/transfermarkt-datasets, CC-licensed,
 * itself sourced from public Transfermarkt pages).
 *
 * `overall`/`potential` are NOT copied from any FIFA/EA-style rating site —
 * they're computed here from a blend of real market value, position-relative
 * per-90 goal contribution, and involvement (minutes), then used as the
 * `quality` seed for the engine's own `generateAttributes()` so the full
 * FM-style attribute vector stays consistent with how @futbol/sim-lab
 * calibrates the match engine. See tools/data-etl/ for the ETL that produced
 * prisma/data/real-top5-2012-2024.json.gz from the raw CSVs.
 *
 * Additive: inserted into the same "era-all-time" era as the fictional seed
 * (packages/db/prisma/seed.ts) rather than replacing it, so both are
 * selectable from the same league picker without any frontend change.
 */

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "real-top5-2012-2024.json.gz");

const ERA = { id: "era-all-time", name: "All-Time", startYear: 1992, endYear: 2025 };

interface RealLeague {
  id: string;
  name: string;
  country: string;
  tier: number;
}
interface RealClub {
  id: string;
  name: string;
  country: string;
}
interface RealClubSeason {
  id: string;
  clubId: string;
  seasonYear: number;
  leagueId: string;
  reputation: number;
}
interface RealPlayer {
  id: string;
  name: string;
  nationality: string;
  dateOfBirth: string;
  photoUrl: string | null;
}
interface RealPlayerSeason {
  id: string;
  playerId: string;
  clubSeasonId: string;
  seasonYear: number;
  positions: string[];
  preferredFoot: "left" | "right" | "both";
  overall: number;
  potential: number;
}
interface RealCatalog {
  leagues: RealLeague[];
  clubs: RealClub[];
  clubSeasons: RealClubSeason[];
  players: RealPlayer[];
  playerSeasons: RealPlayerSeason[];
}

function loadCatalog(): RealCatalog {
  const gz = readFileSync(DATA_PATH);
  const json = gunzipSync(gz).toString("utf-8");
  return JSON.parse(json) as RealCatalog;
}

/** Chunk an array for batched createMany calls, keeping each Postgres statement reasonably sized. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  console.log("Seeding real reference data (top-5 leagues, 2012-2024)...");
  const catalog = loadCatalog();

  await prisma.era.upsert({
    where: { id: ERA.id },
    update: {},
    create: ERA,
  });

  for (const league of catalog.leagues) {
    await prisma.refLeague.upsert({
      where: { id: league.id },
      update: { name: league.name, country: league.country, tier: league.tier, eraId: ERA.id },
      create: { id: league.id, eraId: ERA.id, name: league.name, country: league.country, tier: league.tier },
    });
  }
  console.log(`Upserted ${catalog.leagues.length} leagues.`);

  const clubRows: Prisma.RefClubCreateManyInput[] = catalog.clubs.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
  }));
  for (const batch of chunk(clubRows, 2000)) {
    await prisma.refClub.createMany({ data: batch, skipDuplicates: true });
  }
  console.log(`Inserted ${clubRows.length} clubs.`);

  const clubSeasonRows: Prisma.RefClubSeasonCreateManyInput[] = catalog.clubSeasons.map((cs) => ({
    id: cs.id,
    clubId: cs.clubId,
    seasonYear: cs.seasonYear,
    leagueId: cs.leagueId,
    reputation: cs.reputation,
  }));
  for (const batch of chunk(clubSeasonRows, 2000)) {
    await prisma.refClubSeason.createMany({ data: batch, skipDuplicates: true });
  }
  console.log(`Inserted ${clubSeasonRows.length} club-seasons.`);

  const playerRows: Prisma.RefPlayerCreateManyInput[] = catalog.players.map((p) => ({
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    dateOfBirth: new Date(p.dateOfBirth),
    photoUrl: p.photoUrl,
  }));
  for (const batch of chunk(playerRows, 2000)) {
    await prisma.refPlayer.createMany({ data: batch, skipDuplicates: true });
  }
  console.log(`Inserted ${playerRows.length} players.`);

  // createMany + skipDuplicates only inserts genuinely new rows — it silently
  // no-ops on rows that already exist, so a rerun (e.g. after adding a new
  // field like photoUrl) wouldn't backfill it onto players seeded earlier.
  // Explicitly sync photoUrl for everyone so reruns stay idempotent in practice.
  for (const batch of chunk(playerRows, 500)) {
    await prisma.$transaction(
      batch.map((p) => prisma.refPlayer.update({ where: { id: p.id! }, data: { photoUrl: p.photoUrl ?? null } })),
    );
  }
  console.log(`Synced photoUrl for ${playerRows.length} players.`);

  const rng = createRng(42n);
  const playerSeasonRows: Prisma.RefPlayerSeasonCreateManyInput[] = catalog.playerSeasons.map((ps) => {
    const quality = Math.min(1, Math.max(0, ps.overall / 99));
    return {
      id: ps.id,
      playerId: ps.playerId,
      clubSeasonId: ps.clubSeasonId,
      seasonYear: ps.seasonYear,
      positions: ps.positions,
      preferredFoot: ps.preferredFoot,
      weakFoot: (ps.preferredFoot === "both" ? 4 : 2) + Math.floor(rng() * 2),
      attributes: generateAttributes(rng, quality) as unknown as Prisma.InputJsonValue,
      overall: ps.overall,
      potential: ps.potential,
      traits: [],
    };
  });
  for (const batch of chunk(playerSeasonRows, 2000)) {
    await prisma.refPlayerSeason.createMany({ data: batch, skipDuplicates: true });
  }
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
