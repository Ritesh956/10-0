import type { DailyConstraintDto, DailyPoolStatsDto, PlayerSeasonDto } from "../api/types";

/** Same predicate as apps/api/src/daily/daily.logic.ts's matchesConstraint, mirrored here (this
    package hand-mirrors domain shapes rather than importing @futbol/domain — see CLAUDE.md). */
export function matchesConstraint(player: { nationality: string; clubId: string }, constraint: DailyConstraintDto): boolean {
  return constraint.type === "nationality" ? player.nationality === constraint.value : player.clubId === constraint.value;
}

/** How many of the user's current (deduped-by-player) picks already satisfy one constraint. */
export function countMatches(picks: PlayerSeasonDto[], constraint: DailyConstraintDto): number {
  const seen = new Set<string>();
  let count = 0;
  for (const p of picks) {
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    if (matchesConstraint({ nationality: p.player.nationality, clubId: p.clubSeason.club.id }, constraint)) count++;
  }
  return count;
}

/**
 * Share of daily spins that are steered toward an unmet requirement: the reel picks one unmet
 * constraint at random and draws from the club-seasons that have a player satisfying it (the
 * challenge's `clubSeasonIdsPerConstraint`); the rest are drawn from the whole pool as usual. Without
 * it a "2 other Salernitana players" brief is a 2-in-1,300 draw and the odds read 0% before the first
 * spin. 0.3 keeps the puzzle a real puzzle — a typical brief starts around 70-90%.
 */
export const DAILY_BOOST_SHARE = 0.3;

/** Unmet constraints' indices — the only ones the reel boosts toward. */
function unmetIndices(constraints: DailyConstraintDto[], matched: number[]): number[] {
  return constraints.map((c, i) => ((matched[i] ?? 0) < c.required ? i : -1)).filter((i) => i >= 0);
}

/**
 * Chooses which club-seasons the next spin draws from: with probability DAILY_BOOST_SHARE, the pool
 * of one randomly chosen unmet constraint (restricted to `candidateIds`); otherwise null, meaning
 * "draw from everything". `random` is injectable for tests.
 */
export function boostedDrawIds(
  constraints: DailyConstraintDto[],
  matched: number[],
  poolStats: DailyPoolStatsDto,
  candidateIds: Set<string>,
  random: () => number = Math.random,
): string[] | null {
  const pools = poolStats.clubSeasonIdsPerConstraint;
  const unmet = unmetIndices(constraints, matched);
  if (!pools || unmet.length === 0 || random() >= DAILY_BOOST_SHARE) return null;
  const pick = unmet[Math.floor(random() * unmet.length)]!;
  const ids = (pools[pick] ?? []).filter((id) => candidateIds.has(id));
  return ids.length > 0 ? ids : null;
}

/**
 * Per constraint, the chance that one spin offers a player who satisfies it: a boosted spin aimed at
 * it (always offers one) plus an ordinary spin that happens to land on one of its club-seasons.
 * Challenges without boost pools (none should remain — the API backfills them) fall back to the
 * people-share, treating a drawn squad as ~25 random players.
 */
export function offerChances(
  constraints: DailyConstraintDto[],
  matched: number[],
  poolStats: DailyPoolStatsDto,
  drawPoolIds: Set<string>,
): number[] {
  const pools = poolStats.clubSeasonIdsPerConstraint;
  const unmet = unmetIndices(constraints, matched);
  return constraints.map((_, i) => {
    if (!pools || drawPoolIds.size === 0) {
      const share = poolStats.totalPlayers > 0 ? (poolStats.eligiblePerConstraint[i] ?? 0) / poolStats.totalPlayers : 0;
      return 1 - (1 - share) ** 25;
    }
    const inPool = (pools[i] ?? []).filter((id) => drawPoolIds.has(id)).length;
    const natural = inPool / drawPoolIds.size;
    const boosted = unmet.includes(i) && inPool > 0 ? DAILY_BOOST_SHARE / unmet.length : 0;
    return Math.min(1, boosted + (1 - DAILY_BOOST_SHARE) * natural);
  });
}

export interface CompletionOddsInput {
  /** Empty pitch slots still to fill (not counting the anchor, which is pre-placed). */
  openSlots: number;
  /** Rerolls left — a draw with nothing useful can be redrawn without spending a slot. */
  rerollsRemaining: number;
  constraints: DailyConstraintDto[];
  /** Aligned with `constraints` — matches already banked from picks so far. */
  matchedByConstraint: number[];
  /** Aligned with `constraints` — from offerChances(). */
  offerChance: number[];
}

/** Chance an offered matching player can actually go in one of `openSlots` open positions: a club
    brief offers a whole squad of matching players, a nationality brief usually one or two. */
function slotFit(constraint: DailyConstraintDto, openSlots: number): number {
  const matchingPlayersOffered = constraint.type === "club" ? 6 : 1.5;
  return 1 - 0.7 ** (openSlots * matchingPlayersOffered);
}

/**
 * Live "COMPLETION ODDS %" (38-0 §7c): the probability of meeting every requirement from here,
 * computed over the actual draft mechanic rather than a flat sampling model — each remaining slot
 * is one spin; a spin offers a match for each unmet constraint with its offerChance (thinned by how
 * likely that player fits an open position); the player takes whichever match helps most; a useless
 * spin is rerolled while rerolls last. Exact dynamic programme over (slots, rerolls, still-needed),
 * which is tiny (<= 11 x 4 x 3 x 3 states). Handles up to two constraints, which is all the daily
 * generator ever produces; any further constraint is multiplied in independently.
 */
export function computeCompletionOdds(input: CompletionOddsInput): number {
  const { constraints, matchedByConstraint, offerChance } = input;
  const need = constraints.map((c, i) => Math.max(0, c.required - (matchedByConstraint[i] ?? 0)));
  if (need.every((n) => n === 0)) return 100;
  if (need.some((n) => n > input.openSlots)) return 0;

  const memo = new Map<string, number>();
  const q = (i: number, slots: number) => (constraints[i] ? (offerChance[i] ?? 0) * slotFit(constraints[i]!, slots) : 0);

  function solve(slots: number, rerolls: number, a: number, b: number): number {
    if (a === 0 && b === 0) return 1;
    if (slots === 0 || a + b > slots) return 0;
    const key = `${slots}|${rerolls}|${a}|${b}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const q1 = a > 0 ? q(0, slots) : 0;
    const q2 = b > 0 ? q(1, slots) : 0;
    const takeBest = (o1: boolean, o2: boolean): number => {
      const options: number[] = [];
      if (o1) options.push(solve(slots - 1, rerolls, a - 1, b));
      if (o2) options.push(solve(slots - 1, rerolls, a, b - 1));
      if (options.length > 0) return Math.max(...options);
      return rerolls > 0 ? solve(slots, rerolls - 1, a, b) : solve(slots - 1, 0, a, b);
    };
    const value =
      q1 * q2 * takeBest(true, true) +
      q1 * (1 - q2) * takeBest(true, false) +
      (1 - q1) * q2 * takeBest(false, true) +
      (1 - q1) * (1 - q2) * takeBest(false, false);
    memo.set(key, value);
    return value;
  }

  let odds = solve(input.openSlots, input.rerollsRemaining, need[0] ?? 0, need[1] ?? 0);
  for (let i = 2; i < constraints.length; i++) {
    if (need[i]! > 0) odds *= 1 - (1 - q(i, input.openSlots)) ** (input.openSlots + input.rerollsRemaining);
  }
  return Math.round(Math.max(0, Math.min(1, odds)) * 100);
}
