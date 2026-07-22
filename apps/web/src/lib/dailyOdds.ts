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

export interface CompletionOddsInput {
  /** Empty pitch slots still to fill (not counting the anchor, which is pre-placed). */
  openSlots: number;
  /** Undrafted players left in the whole daily pool. */
  totalRemaining: number;
  constraints: DailyConstraintDto[];
  /** Aligned with `constraints` — matches already banked from picks so far. */
  matchedByConstraint: number[];
  /** Aligned with `constraints` — undrafted pool players who'd still satisfy each constraint. */
  eligibleRemainingByConstraint: number[];
}

/** Assembles a CompletionOddsInput from live draft state — the one non-pure helper here, kept
    trivial so computeCompletionOdds itself stays a pure function of plain numbers. */
export function buildOddsInput(
  openSlots: number,
  picks: PlayerSeasonDto[],
  constraints: DailyConstraintDto[],
  poolStats: DailyPoolStatsDto,
): CompletionOddsInput {
  const matchedByConstraint = constraints.map((c) => countMatches(picks, c));
  const eligibleRemainingByConstraint = constraints.map((c, i) =>
    Math.max(0, (poolStats.eligiblePerConstraint[i] ?? 0) - matchedByConstraint[i]!),
  );
  const pickedPlayerIds = new Set(picks.map((p) => p.playerId));
  const totalRemaining = Math.max(0, poolStats.totalPlayers - pickedPlayerIds.size);
  return { openSlots, totalRemaining, constraints, matchedByConstraint, eligibleRemainingByConstraint };
}

function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

function binomialPmf(n: number, p: number, k: number): number {
  return binomialCoefficient(n, k) * p ** k * (1 - p) ** (n - k);
}

/** P(at least `k` successes in `n` independent trials at success-rate `p`) — the "with replacement"
    binomial is a good approximation of sampling without replacement here since the pool (thousands
    of players) is vastly larger than `n` (<=11 open slots). */
function probabilityAtLeastK(n: number, p: number, k: number): number {
  if (k <= 0) return 1;
  if (n <= 0) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let cumulativeBelowK = 0;
  for (let i = 0; i < k; i++) cumulativeBelowK += binomialPmf(n, p, i);
  return 1 - cumulativeBelowK;
}

/**
 * Live "COMPLETION ODDS %" (38-0 §7c): given the remaining open slots and each unmet constraint's
 * still-needed count and eligible-pool fraction, estimates P(every constraint ends up satisfied) —
 * per constraint via the binomial complement above, combined across constraints by treating them as
 * independent (a simplifying approximation; the two daily constraints are on different dimensions —
 * nationality vs. club — so they're only weakly correlated in practice). An already-met constraint
 * contributes probability 1 (no risk left). A constraint that needs more matches than there are open
 * slots left is flagged impossible and the whole thing collapses to 0%.
 */
export function computeCompletionOdds(input: CompletionOddsInput): number {
  let overall = 1;
  for (let i = 0; i < input.constraints.length; i++) {
    const constraint = input.constraints[i]!;
    const matched = input.matchedByConstraint[i] ?? 0;
    const stillNeeded = Math.max(0, constraint.required - matched);
    if (stillNeeded === 0) continue;
    if (stillNeeded > input.openSlots) return 0;
    const p = input.totalRemaining > 0 ? (input.eligibleRemainingByConstraint[i] ?? 0) / input.totalRemaining : 0;
    overall *= probabilityAtLeastK(input.openSlots, p, stillNeeded);
  }
  return Math.round(Math.max(0, Math.min(1, overall)) * 100);
}
