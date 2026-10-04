/**
 * The cross-league "European Nights" format as pure functions (no Nest, no Prisma), so the draw and
 * the bracket are unit-testable without a database.
 *
 * Shape (modelled on the modern continental format, with our own names): 36 clubs from the five real
 * leagues are seeded into four pots by squad strength; each club plays 8 league-phase games — two
 * opponents from every pot, one home and one away, never a club from its own league. The table then
 * splits: 1–8 go straight to the Round of 16, 9–24 play a two-legged play-off for the other eight
 * places, 25–36 are out. Round of 16 → quarter-finals → semi-finals → a single-match final.
 */

export type KnockoutStage = "PO" | "R16" | "QF" | "SF" | "FINAL";
export const KNOCKOUT_STAGES: readonly KnockoutStage[] = ["PO", "R16", "QF", "SF", "FINAL"];

export const POT_COUNT = 4;
/** League-phase finishers who skip the play-off and go straight into the Round of 16. */
export const DIRECT_QUALIFIERS = 8;

export interface Entrant {
  clubId: string;
  /** The league country the club plays in — league-phase opponents are drawn from other countries. */
  country: string;
  /** Squad strength used only for seeding (average overall of the best eleven). */
  strength: number;
}

export interface SeededEntrant extends Entrant {
  /** 1 = strongest. */
  seed: number;
  /** 1–4; pot 1 holds the strongest quarter. */
  pot: number;
}

export interface LeaguePhaseFixture {
  matchday: number;
  homeClubId: string;
  awayClubId: string;
}

/** Strongest first; ties broken by club id so the seeding is reproducible from the same data. */
export function seedEntrants(entrants: Entrant[]): SeededEntrant[] {
  const n = entrants.length;
  if (n % POT_COUNT !== 0 || n / POT_COUNT < 3) {
    throw new Error(`A ${POT_COUNT}-pot draw needs a multiple of ${POT_COUNT} clubs, at least ${POT_COUNT * 3} (got ${n})`);
  }
  const potSize = n / POT_COUNT;
  return [...entrants]
    .sort((a, b) => b.strength - a.strength || a.clubId.localeCompare(b.clubId))
    .map((entrant, i) => ({ ...entrant, seed: i + 1, pot: Math.floor(i / potSize) + 1 }));
}

/** mulberry32 — the same tiny generator the engine uses, local so the API needs no engine runtime dep. */
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

function shuffle<T>(list: T[], rng: () => number): void {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
}

type Pair = [home: SeededEntrant, away: SeededEntrant];

/**
 * A perfect matching left→right over `allowed` edges, found with randomised augmenting paths so the
 * result varies with the rng. Any left node the allowed graph can't cover is paired with a leftover
 * right node (still avoiding `banned` pairs) — that fallback only matters if a pot is dominated by
 * one league, and then a same-league game is better than no game.
 */
function randomMatching(
  m: number,
  allowed: (left: number, right: number) => boolean,
  banned: (left: number, right: number) => boolean,
  rng: () => number,
): number[] {
  const leftOf = Array<number>(m).fill(-1);
  const rightOrder = Array.from({ length: m }, (_, j) => j);
  const augment = (i: number, seen: Set<number>): boolean => {
    const order = [...rightOrder];
    shuffle(order, rng);
    for (const j of order) {
      if (!allowed(i, j) || banned(i, j) || seen.has(j)) continue;
      seen.add(j);
      if (leftOf[j] === -1 || augment(leftOf[j]!, seen)) {
        leftOf[j] = i;
        return true;
      }
    }
    return false;
  };
  const lefts = Array.from({ length: m }, (_, i) => i);
  shuffle(lefts, rng);
  for (const i of lefts) augment(i, new Set());

  const rightOf = Array<number>(m).fill(-1);
  leftOf.forEach((i, j) => {
    if (i !== -1) rightOf[i] = j;
  });
  const freeRights = leftOf.map((l, j) => (l === -1 ? j : -1)).filter((j) => j !== -1);
  for (let i = 0; i < m; i++) {
    if (rightOf[i] !== -1) continue;
    const k = freeRights.findIndex((j) => !banned(i, j));
    const pick = k === -1 ? 0 : k;
    rightOf[i] = freeRights.splice(pick, 1)[0]!;
  }
  return rightOf;
}

/**
 * The league-phase pairs. For pots of `m` clubs each, with every club getting four home and four away
 * games and each pairing played once:
 *  - inside a pot, club i hosts club σ(i) (σ has no fixed points or two-cycles) — one home, one away;
 *  - for each pair of pots (P, Q), two disjoint perfect matchings π1, π2: P[i] hosts Q[π1(i)] and
 *    visits Q[π2(i)], so each of the other three pots supplies exactly two opponents, one each way.
 * The matchings are chosen over different-country pairs only, which is what keeps clubs away from
 * their own league's clubs.
 */
function leaguePhasePairs(pots: SeededEntrant[][], rng: () => number): Pair[] {
  const pairs: Pair[] = [];
  const m = pots[0]!.length;
  for (let p = 0; p < pots.length; p++) {
    const pot = pots[p]!;
    let sigma: number[] = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      sigma = randomMatching(
        m,
        (i, j) => i !== j && pot[i]!.country !== pot[j]!.country,
        (i, j) => i === j,
        rng,
      );
      if (sigma.every((j, i) => sigma[j] !== i && j !== i)) break;
    }
    sigma.forEach((j, i) => pairs.push([pot[i]!, pot[j]!]));

    for (let q = p + 1; q < pots.length; q++) {
      const other = pots[q]!;
      const different = (i: number, j: number) => pot[i]!.country !== other[j]!.country;
      const first = randomMatching(m, different, () => false, rng);
      const second = randomMatching(m, different, (i, j) => first[i] === j, rng);
      for (let i = 0; i < m; i++) {
        pairs.push([pot[i]!, other[first[i]!]!]);
        pairs.push([other[second[i]!]!, pot[i]!]);
      }
    }
  }
  return pairs;
}

const sameCountryCount = (pairs: Pair[]) => pairs.filter(([a, b]) => a.country === b.country).length;

/** Greedy edge-colouring: the lowest matchday on which neither club already has a game. */
function assignMatchdays(pairs: Pair[], rng: () => number): LeaguePhaseFixture[] {
  let best: LeaguePhaseFixture[] = [];
  let bestDays = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 120 && bestDays > 8; attempt++) {
    const order = [...pairs];
    shuffle(order, rng);
    const busy = new Map<string, Set<number>>();
    const fixtures: LeaguePhaseFixture[] = [];
    let days = 0;
    for (const [home, away] of order) {
      const homeBusy = busy.get(home.clubId) ?? new Set<number>();
      const awayBusy = busy.get(away.clubId) ?? new Set<number>();
      let day = 1;
      while (homeBusy.has(day) || awayBusy.has(day)) day++;
      homeBusy.add(day);
      awayBusy.add(day);
      busy.set(home.clubId, homeBusy);
      busy.set(away.clubId, awayBusy);
      fixtures.push({ matchday: day, homeClubId: home.clubId, awayClubId: away.clubId });
      days = Math.max(days, day);
    }
    if (days < bestDays) {
      bestDays = days;
      best = fixtures;
    }
  }
  return best.sort((a, b) => a.matchday - b.matchday);
}

/** The league-phase fixture list for seeded entrants (see `leaguePhasePairs` for the structure). */
export function generateLeaguePhase(seeded: SeededEntrant[], rngSeed: number): LeaguePhaseFixture[] {
  const rng = mulberry32(rngSeed);
  const pots: SeededEntrant[][] = Array.from({ length: POT_COUNT }, (_, p) => seeded.filter((s) => s.pot === p + 1));

  // Restarts only matter when a pot is dominated by one league; normally the first try is clean.
  let best: Pair[] = [];
  let bestCost = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 10 && bestCost > 0; attempt++) {
    const pairs = leaguePhasePairs(pots, rng);
    const cost = sameCountryCount(pairs);
    if (cost < bestCost) {
      bestCost = cost;
      best = pairs;
    }
  }
  return assignMatchdays(best, rng);
}

// ---- Knockouts --------------------------------------------------------------------------------

/** A club and its 1-based league-phase finishing position. */
export interface RankedClub {
  clubId: string;
  rank: number;
}
/** [better seed, worse seed] — the better seed is the tie's nominal home side (hosts the decisive leg). */
export type Pairing = [stronger: RankedClub, weaker: RankedClub];

export const pairClubs = (a: RankedClub, b: RankedClub): Pairing => (a.rank <= b.rank ? [a, b] : [b, a]);

/** Where a league-phase finisher goes next. */
export function leaguePhaseZone(rank: number, direct = DIRECT_QUALIFIERS): "R16" | "PO" | "OUT" {
  if (rank <= direct) return "R16";
  if (rank <= direct * 3) return "PO";
  return "OUT";
}

/** Play-off ties for ranks 9–24: 9v24, 10v23 … 16v17. */
export function playoffPairings(table: RankedClub[], direct = DIRECT_QUALIFIERS): Pairing[] {
  const field = table
    .filter((c) => c.rank > direct && c.rank <= direct * 3)
    .sort((a, b) => a.rank - b.rank);
  const pairs: Pairing[] = [];
  for (let k = 0; k < Math.floor(field.length / 2); k++) pairs.push(pairClubs(field[k]!, field[field.length - 1 - k]!));
  return pairs;
}

/**
 * Round of 16 once the play-offs are decided: league-phase seed `s` (1–8) meets the winner of the
 * play-off tie whose better seed was `2·direct + 1 − s` — seed 1 draws the weakest play-off side's
 * path (16v17), seed 8 the strongest (9v24).
 */
export function r16Pairings(
  table: RankedClub[],
  playoffWinners: { strongerRank: number; winner: RankedClub }[],
  direct = DIRECT_QUALIFIERS,
): Pairing[] {
  const pairs: Pairing[] = [];
  for (const bye of table.filter((c) => c.rank <= direct).sort((a, b) => a.rank - b.rank)) {
    const opponent = playoffWinners.find((w) => w.strongerRank === direct * 2 + 1 - bye.rank);
    if (opponent) pairs.push(pairClubs(bye, opponent.winner));
  }
  return pairs;
}

/** Winners listed in bracket order → the next round: first v last, second v second-last … */
export function nextRoundPairings(winnersInBracketOrder: RankedClub[]): Pairing[] {
  const n = winnersInBracketOrder.length;
  const pairs: Pairing[] = [];
  for (let k = 0; k < Math.floor(n / 2); k++) pairs.push(pairClubs(winnersInBracketOrder[k]!, winnersInBracketOrder[n - 1 - k]!));
  return pairs;
}

export interface TieClubs {
  id: string;
  homeClubId: string;
  awayClubId: string;
}

/**
 * Each tie's 0-based place in its round's bracket, recovered from who played whom (nothing about the
 * bracket is stored). The Round of 16 is ordered by its league-phase bye seed; every later round
 * takes the earliest slot of the two earlier ties its clubs came from — which is exactly where
 * `nextRoundPairings` put them, since it pairs slot k with slot n−1−k.
 */
export function bracketOrder(
  rounds: Partial<Record<KnockoutStage, TieClubs[]>>,
  rankOf: (clubId: string) => number,
): Map<string, number> {
  const order = new Map<string, number>();
  let previousSlotByClub: Map<string, number> | null = null;
  for (const stage of ["R16", "QF", "SF", "FINAL"] as const) {
    const ties = rounds[stage];
    if (!ties || ties.length === 0) continue;
    const slotByTie = new Map<string, number>();
    const best = (t: TieClubs) => Math.min(rankOf(t.homeClubId), rankOf(t.awayClubId));
    if (stage === "R16" || previousSlotByClub === null) {
      [...ties]
        .sort((a, b) => best(a) - best(b))
        .forEach((t, i) => slotByTie.set(t.id, stage === "R16" ? best(t) - 1 : i));
    } else {
      const prev = previousSlotByClub;
      for (const t of ties) {
        slotByTie.set(t.id, Math.min(prev.get(t.homeClubId) ?? 0, prev.get(t.awayClubId) ?? 0));
      }
    }
    const slotByClub = new Map<string, number>();
    for (const t of ties) {
      const slot = slotByTie.get(t.id)!;
      slotByClub.set(t.homeClubId, slot);
      slotByClub.set(t.awayClubId, slot);
      order.set(t.id, slot);
    }
    previousSlotByClub = slotByClub;
  }
  return order;
}
