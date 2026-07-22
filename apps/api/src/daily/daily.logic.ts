/** Pure decision logic for Phase 8's Daily Challenge — factored out of daily.service.ts (which is
    Prisma-coupled) so puzzle generation and scoring are unit-testable without mocking the database,
    matching the pattern already used by lineup.ts/round-robin.ts/january.logic.ts. */

export const MAX_DAILY_ATTEMPTS = 5;

/** Deep enough that "N other players sharing this trait" is comfortably satisfiable — a theme
    dimension with fewer real candidates than this is skipped rather than risking an unwinnable puzzle. */
const MIN_POOL_FOR_THEME = 8;

const CURATED_FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "4-5-1"] as const;

export type DailyTheme = "birthday" | "nationality" | "club-history";
export type DailyConstraintType = "nationality" | "club";

/** One draftable real player, deduped to a single canonical row per person (their best season) —
    both generation and scoring reason about *people*, not individual RefPlayerSeason rows, since a
    real person could otherwise appear at two different seasons/clubs. */
export interface DailyCandidate {
  id: string;
  playerId: string;
  name: string;
  nationality: string;
  /** "MM-DD" slice of the player's real date of birth, for the birthday theme. */
  birthMonthDay: string;
  overall: number;
  clubId: string;
  clubName: string;
  /** Display/placement-only — unused by generation/scoring logic itself, carried through so the
      caller doesn't need a second lookup for the anchor's playable positions and photo. */
  positions: string[];
  photoUrl: string | null;
}

export interface DailyConstraint {
  type: DailyConstraintType;
  /** Nationality name, or clubId for a "club" constraint. */
  value: string;
  /** Human-readable label for the value (nationality name, or club name). */
  label: string;
  /** How many *other* players (beyond the pre-seeded anchor) must satisfy this constraint. */
  required: number;
  description: string;
}

export interface GeneratedChallenge {
  theme: DailyTheme;
  themeLabel: string;
  anchor: DailyCandidate;
  constraints: DailyConstraint[];
  fixedFormation: string;
}

export interface PoolStats {
  /** Total draftable people in the generation pool, excluding the anchor. */
  totalPlayers: number;
  /** Aligned with `constraints` — how many *other* pool players (excluding the anchor) satisfy each. */
  eligiblePerConstraint: number[];
}

/** Small deterministic string hash (FNV-ish) — same date + same salt always yields the same seed,
    which is what makes challenge generation reproducible without persisting the RNG state itself. */
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickDeterministic<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length]!;
}

export function pickFormation(date: string): string {
  return pickDeterministic(CURATED_FORMATIONS, hashSeed(`${date}:formation`));
}

interface Matchable {
  nationality: string;
  clubId: string;
}

function matchesConstraint(candidate: Matchable, constraint: DailyConstraint): boolean {
  return constraint.type === "nationality" ? candidate.nationality === constraint.value : candidate.clubId === constraint.value;
}

/** Groups candidates by a key, keeping only groups with at least `min` members. */
function groupByAtLeast(pool: DailyCandidate[], keyFn: (c: DailyCandidate) => string, min: number): Map<string, DailyCandidate[]> {
  const groups = new Map<string, DailyCandidate[]>();
  for (const c of pool) {
    const key = keyFn(c);
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }
  for (const [key, list] of groups) {
    if (list.length < min) groups.delete(key);
  }
  return groups;
}

function makeConstraint(type: DailyConstraintType, value: string, label: string, required: number): DailyConstraint {
  const noun = type === "nationality" ? `${label} player` : `player whose featured season was at ${label}`;
  return {
    type,
    value,
    label,
    required,
    description: `${required} other ${noun}${required === 1 ? "" : "s"}`,
  };
}

/**
 * Deterministic per-date puzzle: same `date` ("YYYY-MM-DD") + same `pool` always yields the exact
 * same theme/anchor/constraints/formation — no randomness beyond a seed derived from the date
 * string, so it's reproducible without persisting anything but the date itself. `pool` must already
 * be deduped to one row per real person (see daily.service.ts) and is re-sorted here by `id` so
 * generation doesn't depend on the caller's query ordering.
 */
export function generateChallenge(date: string, pool: DailyCandidate[]): GeneratedChallenge {
  if (pool.length === 0) throw new Error("Cannot generate a daily challenge from an empty pool");
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));

  const monthDay = date.slice(5);
  const birthdayMatches = sorted.filter((c) => c.birthMonthDay === monthDay);
  const nationalityGroups = groupByAtLeast(sorted, (c) => c.nationality, MIN_POOL_FOR_THEME);
  const clubGroups = groupByAtLeast(sorted, (c) => c.clubId, MIN_POOL_FOR_THEME);

  const availableThemes: DailyTheme[] = [];
  if (birthdayMatches.length > 0) availableThemes.push("birthday");
  if (nationalityGroups.size > 0) availableThemes.push("nationality");
  if (clubGroups.size > 0) availableThemes.push("club-history");

  // Degenerate/tiny pool (a unit-test fixture, never the real top-5 catalog) — fall back to the
  // single best player as anchor with a zero-requirement constraint rather than throwing.
  if (availableThemes.length === 0) {
    const anchor = sorted.reduce((best, c) => (c.overall > best.overall ? c : best));
    return {
      theme: "nationality",
      themeLabel: `Spotlight: ${anchor.nationality}`,
      anchor,
      constraints: [makeConstraint("nationality", anchor.nationality, anchor.nationality, 0)],
      fixedFormation: pickFormation(date),
    };
  }

  const theme = pickDeterministic(availableThemes, hashSeed(`${date}:theme`));

  let anchor: DailyCandidate;
  let themeLabel: string;
  if (theme === "birthday") {
    anchor = pickDeterministic(birthdayMatches, hashSeed(`${date}:birthday`));
    themeLabel = `Happy Birthday, ${anchor.name}`;
  } else if (theme === "nationality") {
    const nations = [...nationalityGroups.keys()].sort();
    const nation = pickDeterministic(nations, hashSeed(`${date}:nationality`));
    anchor = nationalityGroups.get(nation)!.reduce((best, c) => (c.overall > best.overall ? c : best));
    themeLabel = `Nation Spotlight: ${nation}`;
  } else {
    const clubIds = [...clubGroups.keys()].sort();
    const clubId = pickDeterministic(clubIds, hashSeed(`${date}:club`));
    anchor = clubGroups.get(clubId)!.reduce((best, c) => (c.overall > best.overall ? c : best));
    themeLabel = `Club Legends: ${anchor.clubName}`;
  }

  const nationalityPoolSize = sorted.filter((c) => c.nationality === anchor.nationality && c.playerId !== anchor.playerId).length;
  const clubPoolSize = sorted.filter((c) => c.clubId === anchor.clubId && c.playerId !== anchor.playerId).length;

  // The theme's own dimension becomes the "2 other ..." headline constraint; the other dimension
  // (still derived from the same anchor) becomes the lighter "1 other ..." secondary constraint —
  // mirrors 38-0's observed "2 Man City + 1 Norwegian" compound-brief pattern regardless of theme.
  const constraints =
    theme === "club-history"
      ? [
          makeConstraint("club", anchor.clubId, anchor.clubName, Math.min(2, clubPoolSize)),
          makeConstraint("nationality", anchor.nationality, anchor.nationality, Math.min(1, nationalityPoolSize)),
        ]
      : [
          makeConstraint("nationality", anchor.nationality, anchor.nationality, Math.min(2, nationalityPoolSize)),
          makeConstraint("club", anchor.clubId, anchor.clubName, Math.min(1, clubPoolSize)),
        ];

  return {
    theme,
    themeLabel,
    anchor,
    constraints: constraints.filter((c) => c.required > 0),
    fixedFormation: pickFormation(date),
  };
}

export function computePoolStats(pool: DailyCandidate[], anchor: DailyCandidate, constraints: DailyConstraint[]): PoolStats {
  const others = pool.filter((c) => c.playerId !== anchor.playerId);
  return {
    totalPlayers: others.length,
    eligiblePerConstraint: constraints.map((c) => others.filter((candidate) => matchesConstraint(candidate, c)).length),
  };
}

export interface ScoredPick {
  playerId: string;
  nationality: string;
  clubId: string;
}

export interface ConstraintResult {
  constraint: DailyConstraint;
  matched: number;
  met: boolean;
  points: number;
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  results: ConstraintResult[];
}

function dedupeByPlayerId<T extends { playerId: string }>(picks: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const p of picks) {
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    result.push(p);
  }
  return result;
}

/**
 * Scores a submitted attempt against the puzzle's constraints. `picks` must be the user's drafted
 * squad *excluding* the anchor — every `required` count already means "beyond the anchor", since
 * the anchor trivially satisfies both constraints by construction (they're derived from its own
 * attributes). Meeting a constraint's requirement exactly earns full marks for it (10 pts/match, up
 * to `required*10`); overshooting keeps adding a smaller bonus (2 pts/match) with no cap, so
 * `score` can exceed `maxScore` — "exceeding a constraint's minimum still improves your score".
 */
export function computeScore(picks: ScoredPick[], constraints: DailyConstraint[]): ScoreResult {
  const distinctPicks = dedupeByPlayerId(picks);
  let score = 0;
  let maxScore = 0;
  const results = constraints.map((constraint) => {
    const matched = distinctPicks.filter((p) => matchesConstraint(p, constraint)).length;
    const points = Math.min(matched, constraint.required) * 10 + Math.max(0, matched - constraint.required) * 2;
    score += points;
    maxScore += constraint.required * 10;
    return { constraint, matched, met: matched >= constraint.required, points };
  });
  return { score, maxScore, results };
}
