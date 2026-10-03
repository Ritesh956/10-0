import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRng, type Rng } from "@futbol/engine";
import type { Position } from "@futbol/domain";
import {
  buildAiLeague,
  canPlay,
  formationSlots,
  loadRealCatalog,
  rateCatalog,
  sampleUserSeasons,
  tableShape,
  type CatalogPlayerSeason,
  type ProjectionSample,
  type RealCatalog,
  type TableShape,
} from "./real-league.js";

/**
 * Generates the pre-season projection table the web app ships (apps/web/src/lib/projectionTable.ts)
 * and prints the numbers the squad/unit tier bands are cut from.
 *
 *   pnpm --filter @futbol/sim-lab exec tsx src/calibrate.ts            # print only
 *   pnpm --filter @futbol/sim-lab exec tsx src/calibrate.ts --write    # also rewrite the web table
 *
 * Projection: for every real league, a user XI at each overall bucket replaces one AI club in that
 * league's real current field and plays many full seasons (real-league.ts mirrors the live
 * pipeline), recording points and finishing position. Leagues run in parallel child processes.
 * Re-run this after changing engine constants, the OVR curve (tools/data-etl/ovr_spread.py), the
 * rating→quality map, or the dataset — the projection must describe the seasons players actually get.
 */

const OVERALL_BUCKETS = Array.from({ length: 17 }, (_, i) => 62 + i * 2); // 62..94
const DEFAULT_SEASONS = 100;
const WEB_TABLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web/src/lib/projectionTable.ts");

interface LeagueResult {
  leagueId: string;
  name: string;
  clubs: number;
  shape: TableShape;
  aiOveralls: number[];
  samples: ProjectionSample[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// --- child: one league ---

function runLeague(leagueId: string, seasons: number): LeagueResult {
  const catalog = loadRealCatalog();
  const rated = rateCatalog(catalog);
  const ai = buildAiLeague(catalog, rated, leagueId);
  const league = catalog.leagues.find((l) => l.id === leagueId)!;
  return {
    leagueId,
    name: league.name,
    clubs: ai.length,
    shape: tableShape(ai, 20),
    aiOveralls: ai.map((c) => Math.round(c.overall * 10) / 10),
    samples: OVERALL_BUCKETS.map((ov) => sampleUserSeasons(ai, rated, ov, seasons)),
  };
}

function runChild(leagueId: string, seasons: number): Promise<LeagueResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--child", leagueId, "--seasons", String(seasons)], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.on("exit", (code) => (code === 0 ? resolve(JSON.parse(out) as LeagueResult) : reject(new Error(`${leagueId} exited ${code}`))));
  });
}

// --- smoothing ---

/** Pool-adjacent-violators: the closest non-decreasing sequence (equal weights). */
function isotonic(values: number[]): number[] {
  const blocks: { sum: number; n: number }[] = [];
  for (const v of values) {
    blocks.push({ sum: v, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2]!.sum / blocks[blocks.length - 2]!.n > blocks[blocks.length - 1]!.sum / blocks[blocks.length - 1]!.n) {
      const last = blocks.pop()!;
      blocks[blocks.length - 1]!.sum += last.sum;
      blocks[blocks.length - 1]!.n += last.n;
    }
  }
  return blocks.flatMap((b) => Array<number>(b.n).fill(b.sum / b.n));
}

/** 1-2-1 smoothing that leaves the endpoints alone, then re-enforces monotonicity. */
function smoothUp(values: number[]): number[] {
  const iso = isotonic(values);
  const sm = iso.map((v, i) => (i === 0 || i === iso.length - 1 ? v : (iso[i - 1]! + 2 * v + iso[i + 1]!) / 4));
  return isotonic(sm);
}
const smoothDown = (values: number[]) => smoothUp(values.map((v) => -v)).map((v) => -v);

export interface ProjectionRow {
  overall: number;
  points: number;
  finish: number;
  win: number;
  top4: number;
  top6: number;
  top10: number;
  relegation: number;
}

function toRows(r: LeagueResult): ProjectionRow[] {
  const relegated = Math.max(3, Math.round(r.clubs * 0.15));
  const pct = (s: ProjectionSample, pred: (pos: number) => boolean) =>
    (s.finishCounts.reduce((sum, c, i) => sum + (pred(i + 1) ? c : 0), 0) / s.seasons) * 100;
  const col = (pred: (pos: number) => boolean) => r.samples.map((s) => pct(s, pred));
  const points = smoothUp(r.samples.map((s) => s.meanPoints));
  const finish = smoothDown(r.samples.map((s) => s.meanFinish));
  const win = smoothUp(col((p) => p === 1));
  const top4 = smoothUp(col((p) => p <= 4));
  const top6 = smoothUp(col((p) => p <= 6));
  const top10 = smoothUp(col((p) => p <= 10));
  const relegation = smoothDown(col((p) => p > r.clubs - relegated));
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return r.samples.map((s, i) => ({
    overall: s.overall,
    points: r1(points[i]!),
    finish: r1(finish[i]!),
    // win <= top4 <= top6 <= top10 must hold row-wise too, whatever the per-column smoothing did
    win: r1(win[i]!),
    top4: r1(Math.max(win[i]!, top4[i]!)),
    top6: r1(Math.max(win[i]!, top4[i]!, top6[i]!)),
    top10: r1(Math.max(win[i]!, top4[i]!, top6[i]!, top10[i]!)),
    relegation: r1(relegation[i]!),
  }));
}

// --- draft distribution (for tier bands) ---

/** Overall of an XI built the way a sensible player drafts: each spin draws a random club-season
    from the league, and they take the best player who fits any open slot (no rerolls). `prime`
    swaps every player for their own career-best season, like the "Prime" ratings mode. */
function simulateDraft(
  byClubSeason: Map<string, CatalogPlayerSeason[]>,
  clubSeasonIds: string[],
  primeOf: Map<string, CatalogPlayerSeason>,
  prime: boolean,
  rng: Rng,
): { overall: number; units: Record<"GK" | "DEF" | "MID" | "ATT", number[]> } {
  const open = [...formationSlots("4-3-3")];
  const picked = new Set<string>();
  const units: Record<"GK" | "DEF" | "MID" | "ATT", number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  const groupOf = (slot: Position) => (slot === "GK" ? "GK" : ["LB", "CB", "RB"].includes(slot) ? "DEF" : ["CDM", "CM"].includes(slot) ? "MID" : "ATT");
  let total = 0;
  for (let guard = 0; open.length > 0 && guard < 200; guard++) {
    const cs = clubSeasonIds[Math.floor(rng() * clubSeasonIds.length)]!;
    const pool = (byClubSeason.get(cs) ?? []).map((p) => (prime ? (primeOf.get(p.playerId) ?? p) : p)).filter((p) => !picked.has(p.playerId));
    let best: { p: CatalogPlayerSeason; slotIdx: number } | undefined;
    for (const p of pool) {
      const slotIdx = open.findIndex((slot) => canPlay(p.positions, slot));
      if (slotIdx >= 0 && (!best || p.overall > best.p.overall)) best = { p, slotIdx };
    }
    if (!best) continue;
    const [slot] = open.splice(best.slotIdx, 1);
    picked.add(best.p.playerId);
    units[groupOf(slot!)].push(best.p.overall);
    total += best.p.overall;
  }
  return { overall: total / 11, units };
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function draftDistribution(catalog: RealCatalog): void {
  const byClubSeason = new Map<string, CatalogPlayerSeason[]>();
  const primeOf = new Map<string, CatalogPlayerSeason>();
  for (const p of catalog.playerSeasons) {
    const list = byClubSeason.get(p.clubSeasonId);
    if (list) list.push(p);
    else byClubSeason.set(p.clubSeasonId, [p]);
    const best = primeOf.get(p.playerId);
    if (!best || p.overall > best.overall) primeOf.set(p.playerId, p);
  }
  const rng = createRng(2026n);
  for (const prime of [false, true]) {
    const overalls: number[] = [];
    const unitVals: number[] = [];
    for (const league of catalog.leagues) {
      const ids = catalog.clubSeasons.filter((c) => c.leagueId === league.id).map((c) => c.id);
      for (let i = 0; i < 1500; i++) {
        const d = simulateDraft(byClubSeason, ids, primeOf, prime, rng);
        overalls.push(d.overall);
        for (const vals of Object.values(d.units)) if (vals.length) unitVals.push(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
    }
    overalls.sort((a, b) => a - b);
    unitVals.sort((a, b) => a - b);
    const ps = [0.03, 0.1, 0.25, 0.5, 0.75, 0.9, 0.97, 0.99];
    console.log(`\nGreedy draft overall (${prime ? "prime" : "season"} ratings, all leagues, all years):`);
    console.log("  " + ps.map((p) => `p${Math.round(p * 100)} ${percentile(overalls, p).toFixed(1)}`).join("  "));
    console.log("  unit averages: " + ps.map((p) => `p${Math.round(p * 100)} ${percentile(unitVals, p).toFixed(1)}`).join("  "));
  }
}

// --- main ---

/** One row per line so the generated file stays reviewable (and diffs stay readable). */
function formatTable(leagues: Record<string, { name: string; clubs: number; rows: ProjectionRow[] }>): string {
  const row = (r: ProjectionRow) => `      ${JSON.stringify(r).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ")},`;
  const blocks = Object.entries(leagues).map(
    ([id, l]) =>
      [`  ${JSON.stringify(id)}: {`, `    name: ${JSON.stringify(l.name)},`, `    clubs: ${l.clubs},`, "    rows: [", ...l.rows.map(row), "    ],", "  },"].join("\n"),
  );
  return `{\n${blocks.join("\n")}\n}`;
}

function writeWebTable(results: LeagueResult[]): void {
  const leagues = Object.fromEntries(
    results.map((r) => [r.leagueId, { name: r.name, clubs: r.clubs, rows: toRows(r) }]),
  );
  const body = `// GENERATED by tools/sim-lab/src/calibrate.ts --write — do not edit by hand. Re-run it after
// changing the engine, the OVR curve or the dataset so projections keep matching real simulations.
// Each row: a user XI of that overall replacing one AI club in the league's real current field,
// averaged over many simulated seasons — expected points, mean finish, and the % of seasons that
// ended 1st / top 4 / top 6 / top 10 / relegated.

export interface ProjectionRow {
  overall: number;
  points: number;
  finish: number;
  win: number;
  top4: number;
  top6: number;
  top10: number;
  relegation: number;
}

export interface LeagueProjection {
  name: string;
  clubs: number;
  rows: ProjectionRow[];
}

export const PROJECTION_TABLE: Record<string, LeagueProjection> = ${formatTable(leagues)};
`;
  writeFileSync(WEB_TABLE, body);
  console.log(`\nWrote ${WEB_TABLE}`);
}

async function main(): Promise<void> {
  const childLeague = arg("--child");
  const seasons = Number(arg("--seasons") ?? DEFAULT_SEASONS);
  if (childLeague) {
    process.stdout.write(JSON.stringify(runLeague(childLeague, seasons)));
    return;
  }

  const catalog = loadRealCatalog();
  draftDistribution(catalog);

  const started = Date.now();
  const results = await Promise.all(catalog.leagues.map((l) => runChild(l.id, seasons)));
  console.log(`\nSimulated ${seasons} seasons per bucket per league in ${Math.round((Date.now() - started) / 1000)}s`);

  for (const r of results) {
    const s = r.shape;
    console.log(
      `\n${r.name} (${r.clubs} clubs, AI XIs ${r.aiOveralls[0]}..${r.aiOveralls[r.aiOveralls.length - 1]}): champion ${s.avgChampionPoints.toFixed(1)}, ` +
        `safety ${s.avgSafetyPoints.toFixed(1)}, last ${s.avgLastPoints.toFixed(1)}, strength↔finish ρ ${s.avgStrengthRankCorrelation.toFixed(2)}, ` +
        `strongest wins ${s.strongestTitlePct.toFixed(0)}%, ${s.goalsPerGame.toFixed(2)} goals/game, home ${s.homeWinPct.toFixed(0)}% draw ${s.drawPct.toFixed(0)}%`,
    );
    for (const row of toRows(r)) {
      console.log(
        `  OVR ${row.overall}: ${row.points.toFixed(1)} pts, finish ${row.finish.toFixed(1)}, win ${row.win}% top4 ${row.top4}% top6 ${row.top6}% top10 ${row.top10}% rel ${row.relegation}%`,
      );
    }
  }

  if (process.argv.includes("--write")) writeWebTable(results);
}

void main();
