/** Pure aggregation logic factored out of seasons.service.ts (Prisma-coupled) so it's unit-testable
    without mocking the database — the same pattern as lineup.ts/round-robin.ts/january.logic.ts. */

export interface ClubMatchResult {
  opponentClubId: string;
  ourScore: number;
  theirScore: number;
}

export interface ManagerAggregateStats {
  cleanSheets: number;
  longestWinStreak: number;
  biggestWin: { opponentClubId: string; ourScore: number; theirScore: number; margin: number } | undefined;
  highestScoringMatch: { opponentClubId: string; ourScore: number; theirScore: number; total: number } | undefined;
}

/** Walks a club's results in matchday order (caller must pre-sort) and derives clean sheets, the
    longest consecutive win streak, the biggest win margin, and the highest-combined-goals match —
    the four signals behind the manager stat card. */
export function computeManagerStats(results: ClubMatchResult[]): ManagerAggregateStats {
  let cleanSheets = 0;
  let longestWinStreak = 0;
  let currentWinStreak = 0;
  let biggestWin: ManagerAggregateStats["biggestWin"];
  let highestScoringMatch: ManagerAggregateStats["highestScoringMatch"];

  for (const { opponentClubId, ourScore, theirScore } of results) {
    if (theirScore === 0) cleanSheets += 1;

    if (ourScore > theirScore) {
      currentWinStreak += 1;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      const margin = ourScore - theirScore;
      if (!biggestWin || margin > biggestWin.margin) biggestWin = { opponentClubId, ourScore, theirScore, margin };
    } else {
      currentWinStreak = 0;
    }

    const total = ourScore + theirScore;
    if (!highestScoringMatch || total > highestScoringMatch.total) {
      highestScoringMatch = { opponentClubId, ourScore, theirScore, total };
    }
  }

  return { cleanSheets, longestWinStreak, biggestWin, highestScoringMatch };
}
