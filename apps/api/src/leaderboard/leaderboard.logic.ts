/** Pure helpers factored out of leaderboard.service.ts (Prisma-coupled) so they're unit-testable
    without mocking the database — the same pattern as lineup.ts/round-robin.ts/january.logic.ts. */

import type { TrophyKey } from "@futbol/domain";

export type LeaderboardTimeWindow = "today" | "week" | "all";

/** Returns the earliest `createdAt` a row must have to fall inside the window, or undefined for
    "all" (no lower bound). "today"/"week" are relative to `now`, always in whole days, so this
    stays a pure function of its inputs rather than reading the system clock itself. */
export function resolveTimeWindowCutoff(window: LeaderboardTimeWindow, now: Date): Date | undefined {
  if (window === "all") return undefined;
  const days = window === "today" ? 1 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export interface LeaderboardRunRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDiff: number;
}

/** 38-0's RESULT column: a perfect record (won every match, so drawn/lost are both necessarily 0)
    reads as the app's own namesake "{wins}-0 ✨" score line rather than the generic W-D-L+GD
    string every other row gets. */
export function formatLeaderboardResult(record: LeaderboardRunRecord): string {
  if (record.played > 0 && record.won === record.played) {
    return `${record.won}-0 ✨`;
  }
  // Always sign-prefixed (including "+0"), not just positive values — otherwise a 0 goal
  // difference glues onto the preceding "lost" digit with no separator (e.g. "0-0-0" + "0").
  const gd = record.goalDiff >= 0 ? `+${record.goalDiff}` : `${record.goalDiff}`;
  return `${record.won}-${record.drawn}-${record.lost}${gd}`;
}

/**
 * One-Club XI (Phase 7) comparative trophies: "beat the club record" and "the club's worst-ever"
 * — benchmarked against prior *simulated* LeaderboardEntry.points for the same refClubId, since our
 * dataset has no real per-season historical standings to compare against (RefClubSeason carries no
 * points/table data — see trophies.ts's TrophyKey comment). `priorPoints` must exclude this run's
 * own just-upserted row. Requires at least one prior entry to compare against — the very first
 * submission for a club is trivially both the best and worst ever, which isn't a meaningful
 * "record" in either direction, so it earns neither trophy. A tie with the existing best/worst
 * doesn't count as *beating* it either way.
 */
export function evaluateClubRecordTrophies(newPoints: number, priorPoints: number[]): TrophyKey[] {
  if (priorPoints.length === 0) return [];
  const trophies: TrophyKey[] = [];
  if (newPoints > Math.max(...priorPoints)) trophies.push("club-record-breaker");
  if (newPoints < Math.min(...priorPoints)) trophies.push("club-worst-ever");
  return trophies;
}
