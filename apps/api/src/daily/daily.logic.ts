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
  /** Aligned with `constraints` — every real club-season whose squad has at least one player who'd
      satisfy it. The daily reel leans its draws toward these (a club constraint like "2 other
      Salernitana players" is otherwise a 2-in-1,300 draw — the puzzle read 0% before a single spin)
      and the completion odds are computed from the same pools. Absent on challenges generated
      before 2026-10; DailyService backfills it on first read. */
  clubSeasonIdsPerConstraint?: string[][];
}

export interface DailyRecap {
  date: string;
  themeLabel: string;
  players: number;
  topScore: number;
  maxScore: number;
  /** How many players hit maxScore or better. */
  maxedCount: number;
  /** Fewest attempts any player who maxed it used in total, or null if nobody maxed it. */
  fewestAttemptsToMax: number | null;
}

/** Yesterday's community result, from its leaderboard rows — the "Top score 11/11 · maxed in 1"
    strip 38-0 shows above today's puzzle. */
export function summarizeRecap(
  challenge: { date: string; themeLabel: string; maxScore: number },
  entries: { score: number; maxScore: number; attemptsUsed: number }[],
): DailyRecap {
  const maxScore = entries[0]?.maxScore ?? challenge.maxScore;
  const maxed = entries.filter((e) => e.score >= e.maxScore);
  return {
    date: challenge.date,
    themeLabel: challenge.themeLabel,
    players: entries.length,
    topScore: entries.reduce((best, e) => Math.max(best, e.score), 0),
    maxScore,
    maxedCount: maxed.length,
    fewestAttemptsToMax: maxed.length ? Math.min(...maxed.map((e) => e.attemptsUsed)) : null,
  };
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

/** Nationality (as stored, i.e. the country name) -> adjective, for readable briefs ("2 other
    Croatian players", not "2 other Croatia players"). Anything missing falls back to "from X". */
const DEMONYMS: Record<string, string> = {
  Algeria: "Algerian", Argentina: "Argentine", Australia: "Australian", Austria: "Austrian",
  Belgium: "Belgian", "Bosnia-Herzegovina": "Bosnian", Brazil: "Brazilian", Cameroon: "Cameroonian",
  Canada: "Canadian", Chile: "Chilean", Colombia: "Colombian", "Cote d'Ivoire": "Ivorian",
  Croatia: "Croatian", "Czech Republic": "Czech", Denmark: "Danish", Ecuador: "Ecuadorian",
  Egypt: "Egyptian", England: "English", Finland: "Finnish", France: "French", Gabon: "Gabonese",
  Germany: "German", Ghana: "Ghanaian", Greece: "Greek", Guinea: "Guinean", Iceland: "Icelandic",
  Ireland: "Irish", Italy: "Italian", Jamaica: "Jamaican", Japan: "Japanese", "Korea, South": "South Korean",
  Mali: "Malian", Mexico: "Mexican", Morocco: "Moroccan", Netherlands: "Dutch", Nigeria: "Nigerian",
  "Northern Ireland": "Northern Irish", Norway: "Norwegian", Paraguay: "Paraguayan", Peru: "Peruvian",
  Poland: "Polish", Portugal: "Portuguese", Romania: "Romanian", Russia: "Russian", Scotland: "Scottish",
  Senegal: "Senegalese", Serbia: "Serbian", Slovakia: "Slovak", Slovenia: "Slovenian", Spain: "Spanish",
  Sweden: "Swedish", Switzerland: "Swiss", Tunisia: "Tunisian", Turkey: "Turkish", Ukraine: "Ukrainian",
  "United States": "American", Uruguay: "Uruguayan", Venezuela: "Venezuelan", Wales: "Welsh",
};

/** User-facing brief for a constraint. Only the noun is pluralised — appending "s" to the whole
    phrase once produced "…whose featured season was at US Salernitana 1919s". */
export function describeConstraint(type: DailyConstraintType, label: string, required: number): string {
  const players = required === 1 ? "player" : "players";
  if (type === "nationality") {
    const adjective = DEMONYMS[label];
    return adjective ? `${required} other ${adjective} ${players}` : `${required} other ${players} from ${label}`;
  }
  return `${required} other ${label} ${players} (any season at the club)`;
}

function makeConstraint(type: DailyConstraintType, value: string, label: string, required: number): DailyConstraint {
  return {
    type,
    value,
    label,
    required,
    description: describeConstraint(type, label, required),
  };
}

/** Fixed-date national days ("MM-DD"), keyed to RefPlayer.nationality strings. On these dates the
    puzzle is that nation's — the real-calendar hook 38-0's dailies get from fixtures and news. */
export const NATIONAL_DAYS: Record<string, { nation: string; label: string }> = {
  "02-15": { nation: "Serbia", label: "Statehood Day" },
  "03-01": { nation: "Wales", label: "St David's Day" },
  "03-06": { nation: "Ghana", label: "Independence Day" },
  "03-17": { nation: "Ireland", label: "St Patrick's Day" },
  "03-25": { nation: "Greece", label: "Independence Day" },
  "04-04": { nation: "Senegal", label: "Independence Day" },
  "04-23": { nation: "England", label: "St George's Day" },
  "04-27": { nation: "Netherlands", label: "King's Day" },
  "05-03": { nation: "Poland", label: "Constitution Day" },
  "05-17": { nation: "Norway", label: "Constitution Day" },
  "05-25": { nation: "Argentina", label: "May Revolution Day" },
  "05-30": { nation: "Croatia", label: "Statehood Day" },
  "06-02": { nation: "Italy", label: "Festa della Repubblica" },
  "06-05": { nation: "Denmark", label: "Constitution Day" },
  "06-06": { nation: "Sweden", label: "National Day" },
  "06-10": { nation: "Portugal", label: "Portugal Day" },
  "07-04": { nation: "United States", label: "Independence Day" },
  "07-14": { nation: "France", label: "Bastille Day" },
  "07-18": { nation: "Uruguay", label: "Constitution Day" },
  "07-20": { nation: "Colombia", label: "Independence Day" },
  "07-21": { nation: "Belgium", label: "National Day" },
  "08-01": { nation: "Switzerland", label: "Swiss National Day" },
  "08-07": { nation: "Cote d'Ivoire", label: "Independence Day" },
  "09-07": { nation: "Brazil", label: "Independence Day" },
  "09-16": { nation: "Mexico", label: "Independence Day" },
  "10-01": { nation: "Nigeria", label: "Independence Day" },
  "10-03": { nation: "Germany", label: "Day of German Unity" },
  "10-12": { nation: "Spain", label: "Fiesta Nacional" },
  "10-26": { nation: "Austria", label: "National Day" },
  "11-18": { nation: "Morocco", label: "Independence Day" },
  "11-30": { nation: "Scotland", label: "St Andrew's Day" },
};

/** A birthday outranks the date's random theme only for a genuine star. */
export const STAR_BIRTHDAY_OVERALL = 88;
/** Club themes stick to clubs with at least one player this good — a random pick among ~170 clubs
    used to produce briefs like "Club Legends: US Salernitana 1919" that few players could relate to. */
export const NOTABLE_CLUB_OVERALL = 88;

const bestOf = (list: DailyCandidate[]) => list.reduce((best, c) => (c.overall > best.overall ? c : best));

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
  const allClubGroups = groupByAtLeast(sorted, (c) => c.clubId, MIN_POOL_FOR_THEME);
  const notableClubs = new Map([...allClubGroups].filter(([, list]) => bestOf(list).overall >= NOTABLE_CLUB_OVERALL));
  const clubGroups = notableClubs.size > 0 ? notableClubs : allClubGroups;

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

  // The real calendar first: a national day, then a star's birthday; otherwise the date's seed picks.
  const nationalDay = NATIONAL_DAYS[monthDay];
  const nationalDayGroup = nationalDay ? nationalityGroups.get(nationalDay.nation) : undefined;
  const starBirthday = birthdayMatches.length > 0 && bestOf(birthdayMatches).overall >= STAR_BIRTHDAY_OVERALL;
  const theme: DailyTheme = nationalDayGroup
    ? "nationality"
    : starBirthday
      ? "birthday"
      : pickDeterministic(availableThemes, hashSeed(`${date}:theme`));

  let anchor: DailyCandidate;
  let themeLabel: string;
  if (theme === "birthday") {
    // The best-known birthday, not a random one — "Happy Birthday" lands when people know the name.
    anchor = bestOf(birthdayMatches);
    themeLabel = `Happy Birthday, ${anchor.name}`;
  } else if (theme === "nationality" && nationalDay && nationalDayGroup) {
    anchor = bestOf(nationalDayGroup);
    themeLabel = `${nationalDay.label}: ${nationalDay.nation}`;
  } else if (theme === "nationality") {
    const nations = [...nationalityGroups.keys()].sort();
    const nation = pickDeterministic(nations, hashSeed(`${date}:nationality`));
    anchor = bestOf(nationalityGroups.get(nation)!);
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
