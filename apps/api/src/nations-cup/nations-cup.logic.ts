/**
 * The Nations Cup as pure functions: 16 sides (the user's XI plus 15 AI nations built from the best
 * players of each nationality), four groups of four, then a single-leg knockout. Kept free of Nest
 * and Prisma so the draw and the bracket can be unit-tested.
 */

export const NATIONS_COUNT = 16;
export const GROUP_COUNT = 4;
export const GROUP_LETTERS = ["A", "B", "C", "D"] as const;

export interface NationEntrant {
  clubId: string;
  /** Squad strength — average overall of the best eleven. */
  strength: number;
}

export interface SeededNation extends NationEntrant {
  seed: number;
}

/** Strongest first; equal strengths fall back to the club id so the order is reproducible. */
export function seedNations(entrants: NationEntrant[]): SeededNation[] {
  return [...entrants]
    .sort((a, b) => b.strength - a.strength || a.clubId.localeCompare(b.clubId))
    .map((e, i) => ({ ...e, seed: i + 1 }));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Four pots of four by seed; group g receives one club from each pot, drawn at random. */
export function drawGroups(seeded: SeededNation[], rngSeed: number): string[][] {
  if (seeded.length !== NATIONS_COUNT) throw new Error(`The Nations Cup needs ${NATIONS_COUNT} sides (got ${seeded.length})`);
  const rng = mulberry32(rngSeed);
  const pots = Array.from({ length: GROUP_COUNT }, (_, p) => seeded.slice(p * GROUP_COUNT, (p + 1) * GROUP_COUNT).map((s) => s.clubId));
  for (const pot of pots) {
    for (let i = pot.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pot[i], pot[j]] = [pot[j]!, pot[i]!];
    }
  }
  return Array.from({ length: GROUP_COUNT }, (_, g) => pots.map((pot) => pot[g]!));
}

export interface GroupFixture {
  matchday: number;
  homeClubId: string;
  awayClubId: string;
}

/** Single round-robin inside each group, three matchdays, all groups playing on the same days. */
export function groupFixtures(groups: string[][]): GroupFixture[] {
  // Standard 4-team schedule: (0v3, 1v2), (0v2, 3v1), (0v1, 2v3).
  const rounds: [number, number][][] = [
    [[0, 3], [1, 2]],
    [[0, 2], [3, 1]],
    [[0, 1], [2, 3]],
  ];
  return groups.flatMap((group) =>
    rounds.flatMap((pairs, r) => pairs.map(([h, a]) => ({ matchday: r + 1, homeClubId: group[h]!, awayClubId: group[a]! }))),
  );
}

/**
 * Recovers the groups from the fixture list alone — each group's four clubs only ever play each
 * other, so the connected components are the groups. Ordered by the stable minimum club id so the
 * letters (A–D) are the same every time the groups are read back.
 */
export function groupsFromFixtures(fixtures: { homeClubId: string; awayClubId: string }[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  for (const f of fixtures) parent.set(find(f.homeClubId), find(f.awayClubId));
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  return [...groups.values()].map((g) => g.sort()).sort((a, b) => a[0]!.localeCompare(b[0]!));
}

/** A group's table as ordered club ids → the qualifiers (winner, runner-up). */
export interface GroupResult {
  winner: string;
  runnerUp: string;
}

/** Quarter-finals: A1 v B2, C1 v D2, B1 v A2, D1 v C2 — group winners meet the other half's runners-up. */
export function quarterFinalPairs(results: GroupResult[]): [string, string][] {
  const [a, b, c, d] = results;
  if (!a || !b || !c || !d) throw new Error("Four group results are needed for the quarter-finals");
  return [
    [a.winner, b.runnerUp],
    [c.winner, d.runnerUp],
    [b.winner, a.runnerUp],
    [d.winner, c.runnerUp],
  ];
}
