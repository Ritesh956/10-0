/** Mirrors apps/api/src/leaderboard/leaderboard.logic.ts's formatLeaderboardResult — apps/web has
    zero workspace deps by design (see CLAUDE.md), so this stays a small hand-kept duplicate rather
    than a shared import, same convention as lib/trophies.ts's TrophyKey mirror. */
export interface LeaderboardResultRecord {
  won: number;
  drawn: number;
  lost: number;
  goalDiff: number;
}

export function formatLeaderboardResult({ won, drawn, lost, goalDiff }: LeaderboardResultRecord): string {
  const played = won + drawn + lost;
  if (played > 0 && won === played) {
    return `${won}-0 ✨`;
  }
  const gd = goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`;
  return `${won}-${drawn}-${lost}${gd}`;
}
