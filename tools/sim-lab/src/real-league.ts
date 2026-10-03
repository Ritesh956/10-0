import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Formation, MatchSetup, Position, Squad, SquadPlayer, Tactics } from "@futbol/domain";
import { createRng, simulate, type Rng } from "@futbol/engine";
import { generateAttributes, overallToEngineQuality } from "@futbol/engine/testing";

/**
 * Real-league calibration harness: rebuilds what the live game actually feeds the engine — the real
 * top-5 dataset, attributes generated exactly the way packages/db/prisma/seed-real.ts generates
 * them (same rng seed, same call order), AI clubs auto-filled the way SeasonsService
 * .fillAiClubsFromLeague does (the league's latest season, 4-4-2, buildLineup), the post-match
 * fitness dip process-season.ts applies, and a user XI with no bench (draftFantasy's pool is just
 * the 11 drafted players). The synthetic simulateLeagueSeasons() in stats.ts checks the engine in
 * isolation; this checks the projection/tier numbers the player actually sees against the seasons
 * the player actually gets.
 */

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/prisma/data/real-top5-2012-2024.json.gz",
);

export interface CatalogLeague {
  id: string;
  name: string;
  country: string;
}
export interface CatalogClub {
  id: string;
  name: string;
}
export interface CatalogClubSeason {
  id: string;
  clubId: string;
  seasonYear: number;
  leagueId: string;
}
export interface CatalogPlayerSeason {
  id: string;
  playerId: string;
  clubSeasonId: string;
  seasonYear: number;
  positions: Position[];
  preferredFoot: "left" | "right" | "both";
  overall: number;
  potential: number;
}
export interface RealCatalog {
  leagues: CatalogLeague[];
  clubs: CatalogClub[];
  clubSeasons: CatalogClubSeason[];
  playerSeasons: CatalogPlayerSeason[];
}

export function loadRealCatalog(): RealCatalog {
  return JSON.parse(gunzipSync(readFileSync(DATA_PATH)).toString("utf-8")) as RealCatalog;
}

/** A catalog player-season with engine attributes attached, ready to drop into a Squad. */
export interface RatedPlayer extends CatalogPlayerSeason {
  attributes: SquadPlayer["attributes"];
  weakFoot: number;
}

/** Mirrors seed-real.ts's attribute generation exactly: createRng(42n), and for each player-season
    in file order one rng() call for weakFoot, then generateAttributes(rng, quality). */
export function rateCatalog(catalog: RealCatalog, toQuality: (overall: number) => number = overallToEngineQuality): RatedPlayer[] {
  const rng = createRng(42n);
  return catalog.playerSeasons.map((ps) => {
    const quality = toQuality(ps.overall);
    const weakFoot = (ps.preferredFoot === "both" ? 4 : 2) + Math.floor(rng() * 2);
    return { ...ps, weakFoot, attributes: generateAttributes(rng, quality) };
  });
}

// --- lineup filling: a copy of apps/api/src/common/lineup.ts (sim-lab can't depend on apps/api) ---

const FORMATION_POSITIONS: Partial<Record<Formation, Position[]>> = {
  "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"],
};

export const POSITION_COMPATIBILITY: Record<string, Position[]> = {
  GK: ["GK"],
  CB: ["CB", "LB", "RB"],
  LB: ["LB", "LWB", "CB"],
  RB: ["RB", "RWB", "CB"],
  LWB: ["LWB", "LB", "LM"],
  RWB: ["RWB", "RB", "RM"],
  CDM: ["CDM", "CM"],
  CM: ["CM", "CDM", "CAM"],
  CAM: ["CAM", "CM", "ST", "CF"],
  LM: ["LM", "LWB", "LW"],
  RM: ["RM", "RWB", "RW"],
  LW: ["LW", "LM", "ST"],
  RW: ["RW", "RM", "ST"],
  ST: ["ST", "CF", "CAM"],
  CF: ["CF", "ST", "CAM"],
};

const GROUP: Record<string, string> = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LM: "MID",
  RM: "MID",
  LW: "ATT",
  RW: "ATT",
  ST: "ATT",
  CF: "ATT",
};

export function canPlay(positions: readonly Position[], slot: Position): boolean {
  return positions.some((p) => POSITION_COMPATIBILITY[p]?.includes(slot));
}

export function formationSlots(formation: Formation): Position[] {
  const slots = FORMATION_POSITIONS[formation];
  if (!slots) throw new Error(`sim-lab only knows 4-4-2 and 4-3-3 (got ${formation})`);
  return slots;
}

function buildLineup(formation: Formation, pool: RatedPlayer[]): { starters: [Position, RatedPlayer][]; bench: RatedPlayer[] } {
  const slots = formationSlots(formation);
  const available = [...pool];
  const filled: (RatedPlayer | undefined)[] = slots.map(() => undefined);
  const passes: ((p: RatedPlayer, slot: Position) => boolean)[] = [
    (p, slot) => p.positions.includes(slot),
    (p, slot) => canPlay(p.positions, slot),
    (p, slot) => p.positions.some((pos) => GROUP[pos] === GROUP[slot]),
    () => true,
  ];
  for (const fits of passes) {
    slots.forEach((slot, i) => {
      if (filled[i] || available.length === 0) return;
      const matches = available.filter((p) => fits(p, slot));
      if (matches.length === 0) return;
      const best = matches.reduce((a, b) => (b.overall > a.overall ? b : a));
      available.splice(available.indexOf(best), 1);
      filled[i] = best;
    });
  }
  const starters: [Position, RatedPlayer][] = [];
  slots.forEach((slot, i) => {
    const p = filled[i];
    if (p) starters.push([slot, p]);
  });
  return { starters, bench: [...available].sort((a, b) => b.overall - a.overall).slice(0, 12) };
}

// --- squads ---

export interface SimClub {
  id: string;
  name: string;
  /** Mean overall of the starting XI — the same number the UI shows as a squad's "Overall". */
  overall: number;
  squad: Squad;
}

function toSquadPlayer(p: RatedPlayer, uid: string): SquadPlayer {
  return {
    id: uid,
    refPlayerSeasonId: p.id,
    name: p.id,
    age: 26,
    positions: p.positions,
    preferredFoot: p.preferredFoot,
    weakFoot: p.weakFoot,
    attributes: p.attributes,
    overall: p.overall,
    potential: p.potential,
    traits: [],
    fitness: 1,
    morale: 0.5,
    form: 0.5,
    sharpness: 1,
  };
}

function makeClub(id: string, name: string, formation: Formation, starters: [Position, RatedPlayer][], bench: RatedPlayer[]): SimClub {
  const players: SquadPlayer[] = [];
  const startingXI = starters.map(([position, p], i) => {
    const sp = toSquadPlayer(p, `${id}-s${i}`);
    players.push(sp);
    return { position, playerId: sp.id };
  });
  const substitutes = bench.map((p, i) => {
    const sp = toSquadPlayer(p, `${id}-b${i}`);
    players.push(sp);
    return { position: p.positions[0] ?? ("CM" as Position), playerId: sp.id };
  });
  const overall = starters.reduce((s, [, p]) => s + p.overall, 0) / Math.max(1, starters.length);
  return {
    id,
    name,
    overall,
    squad: {
      id,
      worldId: "real-league",
      clubId: id,
      name,
      formation,
      startingXI: startingXI as Squad["startingXI"],
      substitutes,
      players,
    },
  };
}

/** The league's AI clubs exactly as fillAiClubsFromLeague builds them: every club in the league's
    latest season, auto-filled into a 4-4-2. */
export function buildAiLeague(catalog: RealCatalog, rated: RatedPlayer[], leagueId: string): SimClub[] {
  const css = catalog.clubSeasons.filter((c) => c.leagueId === leagueId);
  const latest = Math.max(...css.map((c) => c.seasonYear));
  const clubName = new Map(catalog.clubs.map((c) => [c.id, c.name]));
  const byClubSeason = new Map<string, RatedPlayer[]>();
  for (const p of rated) {
    const list = byClubSeason.get(p.clubSeasonId);
    if (list) list.push(p);
    else byClubSeason.set(p.clubSeasonId, [p]);
  }
  return css
    .filter((c) => c.seasonYear === latest)
    .map((cs) => {
      const { starters, bench } = buildLineup("4-4-2", byClubSeason.get(cs.id) ?? []);
      return makeClub(cs.id, clubName.get(cs.clubId) ?? cs.id, "4-4-2", starters, bench);
    })
    .sort((a, b) => b.overall - a.overall);
}

/** A user-drafted 4-3-3 whose eleven players all sit within ±1 of `targetOverall` (widening only
    if a slot has nobody that close), with no bench — draftFantasy's pool is just the drafted 11. */
export function buildUserXi(rated: RatedPlayer[], targetOverall: number, rng: Rng, id = "user"): SimClub {
  const starters: [Position, RatedPlayer][] = [];
  const used = new Set<string>();
  for (const slot of formationSlots("4-3-3")) {
    for (let width = 1; width < 30; width++) {
      const pool = rated.filter(
        (p) => Math.abs(p.overall - targetOverall) <= width && !used.has(p.playerId) && p.positions.includes(slot),
      );
      if (pool.length === 0) continue;
      const pick = pool[Math.floor(rng() * pool.length)]!;
      used.add(pick.playerId);
      starters.push([slot, pick]);
      break;
    }
  }
  return makeClub(id, "User XI", "4-3-3", starters, []);
}

// --- season simulation ---

const TACTICS: Tactics = { mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" };

function resetFitness(clubs: SimClub[]): void {
  for (const c of clubs) for (const p of c.squad.players) p.fitness = 1;
}

/** One match between two persistent squads, applying process-season.ts's post-match fitness dip. */
export function playMatch(home: SimClub, away: SimClub, seed: bigint): { home: number; away: number } {
  const setup: MatchSetup = {
    matchId: `${home.id}-${away.id}-${seed}`,
    worldId: "real-league",
    home: { clubId: home.id, squad: home.squad, tactics: TACTICS, isHome: true },
    away: { clubId: away.id, squad: away.squad, tactics: TACTICS, isHome: false },
    weather: "clear",
    importance: "league",
    neutralVenue: false,
    rivalryIntensity: 0,
  };
  const r = simulate(setup, seed);
  const byId = new Map([...home.squad.players, ...away.squad.players].map((p) => [p.id, p]));
  for (const stat of r.playerStats) {
    if (stat.minutesPlayed <= 0) continue;
    const p = byId.get(stat.playerId);
    if (p) p.fitness = Math.min(1, Math.max(0.6, 1 - (stat.minutesPlayed / 90) * 0.2));
  }
  return { home: r.homeScore, away: r.awayScore };
}

export interface SeasonTable {
  goals: number;
  games: number;
  homeWins: number;
  draws: number;
  points: number[];
  goalDiff: number[];
  /** club indices, champion first */
  order: number[];
}

/** Circle-method double round-robin by matchday — a copy of apps/api/src/seasons/round-robin.ts.
    Matchday order matters here: the post-match fitness dip means a club that has played faces one
    that hasn't on uneven terms, so fixtures must run round by round exactly like the worker does. */
export function doubleRoundRobin(n: number): [number, number][][] {
  const ids = [...Array(n).keys()] as (number | -1)[];
  if (ids.length % 2 !== 0) ids.push(-1);
  const m = ids.length;
  const firstLeg: [number, number][][] = [];
  let arr = [...ids];
  for (let round = 0; round < m - 1; round++) {
    const day: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i]!;
      const b = arr[m - 1 - i]!;
      if (a === -1 || b === -1) continue;
      day.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    firstLeg.push(day);
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr = [arr[0]!, ...rest];
  }
  return [...firstLeg, ...firstLeg.map((day) => day.map(([h, a]) => [a, h] as [number, number]))];
}

/** One double round-robin over `clubs`, matchday by matchday (fitness reset first). */
export function playSeason(clubs: SimClub[], seedBase: number): SeasonTable {
  resetFitness(clubs);
  const n = clubs.length;
  const points = new Array<number>(n).fill(0);
  const goalDiff = new Array<number>(n).fill(0);
  let game = 0;
  let goals = 0;
  let homeWins = 0;
  let draws = 0;
  for (const day of doubleRoundRobin(n)) {
    for (const [h, a] of day) {
      const r = playMatch(clubs[h]!, clubs[a]!, BigInt(seedBase * 1_000_003 + game++ + 1));
      goals += r.home + r.away;
      if (r.home > r.away) homeWins++;
      else if (r.home === r.away) draws++;
      goalDiff[h]! += r.home - r.away;
      goalDiff[a]! += r.away - r.home;
      if (r.home > r.away) points[h]! += 3;
      else if (r.home < r.away) points[a]! += 3;
      else {
        points[h]! += 1;
        points[a]! += 1;
      }
    }
  }
  const order = [...Array(n).keys()].sort((x, y) => points[y]! - points[x]! || goalDiff[y]! - goalDiff[x]!);
  return { goals, games: game, homeWins, draws, points, goalDiff, order };
}

/** Spearman rank correlation between two equal-length numeric arrays (no tie correction). */
export function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const idx = [...xs.keys()].sort((i, j) => xs[i]! - xs[j]!);
    const r = new Array<number>(xs.length);
    idx.forEach((i, k) => (r[i] = k));
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const d2 = ra.reduce((s, r, i) => s + (r - rb[i]!) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

export interface TableShape {
  avgChampionPoints: number;
  avgLastPoints: number;
  /** average points of the club finishing just above the drop (the "safety line") */
  avgSafetyPoints: number;
  avgSpread: number;
  /** how strongly finishing position tracks squad strength (1 = perfectly by overall) */
  avgStrengthRankCorrelation: number;
  strongestTitlePct: number;
  goalsPerGame: number;
  homeWinPct: number;
  drawPct: number;
}

/** League-shape realism for an AI-only league: champion/safety/last points and strength↔finish correlation. */
export function tableShape(clubs: SimClub[], seasons: number): TableShape {
  const n = clubs.length;
  const strengths = clubs.map((c) => c.overall);
  const strongest = strengths.indexOf(Math.max(...strengths));
  const relegated = Math.max(3, Math.round(n * 0.15));
  let champ = 0;
  let last = 0;
  let safety = 0;
  let corr = 0;
  let strongestTitles = 0;
  let goals = 0;
  let games = 0;
  let homeWins = 0;
  let draws = 0;
  for (let s = 0; s < seasons; s++) {
    const t = playSeason(clubs, s + 1);
    goals += t.goals;
    games += t.games;
    homeWins += t.homeWins;
    draws += t.draws;
    champ += t.points[t.order[0]!]!;
    last += t.points[t.order[n - 1]!]!;
    safety += t.points[t.order[n - relegated - 1]!]!;
    const finish = new Array<number>(n);
    t.order.forEach((club, pos) => (finish[club] = n - pos)); // higher = better, to correlate with strength
    corr += spearman(strengths, finish);
    if (t.order[0] === strongest) strongestTitles++;
  }
  return {
    avgChampionPoints: champ / seasons,
    avgLastPoints: last / seasons,
    avgSafetyPoints: safety / seasons,
    avgSpread: (champ - last) / seasons,
    avgStrengthRankCorrelation: corr / seasons,
    strongestTitlePct: (strongestTitles / seasons) * 100,
    goalsPerGame: goals / games,
    homeWinPct: (homeWins / games) * 100,
    drawPct: (draws / games) * 100,
  };
}

export interface ProjectionSample {
  overall: number;
  seasons: number;
  meanPoints: number;
  meanFinish: number;
  /** finishCounts[k] = seasons finishing in position k+1 */
  finishCounts: number[];
}

/**
 * The user's season outcomes at one squad overall in one league: the user XI replaces one AI club
 * (fillAiClubsFromLeague fills `leagueSize - 1` AI slots) and plays full seasons. A fresh user XI is
 * drawn every season so the sample spans many real player combinations at that overall.
 */
export function sampleUserSeasons(
  aiLeague: SimClub[],
  rated: RatedPlayer[],
  overall: number,
  seasons: number,
  seedOffset = 0,
): ProjectionSample {
  const n = aiLeague.length;
  const finishCounts = new Array<number>(n).fill(0);
  let points = 0;
  let finishSum = 0;
  const rng = createRng(BigInt(overall * 7919 + seedOffset + 1));
  for (let s = 0; s < seasons; s++) {
    // fillAiClubsFromLeague drops whichever AI club falls off the end of its slice; vary which one.
    const dropped = Math.floor(rng() * n);
    const user = buildUserXi(rated, overall, rng);
    const clubs = [user, ...aiLeague.filter((_, i) => i !== dropped)];
    const t = playSeason(clubs, overall * 10_007 + seedOffset * 101 + s + 1);
    const pos = t.order.indexOf(0);
    finishCounts[pos]!++;
    finishSum += pos + 1;
    points += t.points[0]!;
  }
  return { overall, seasons, meanPoints: points / seasons, meanFinish: finishSum / seasons, finishCounts };
}
