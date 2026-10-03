/** A played leg of a knockout tie, as stored: the fixture's own home/away clubs and score. */
export interface PlayedLeg {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
}

export interface TieScore {
  /** Aggregate goals for the tie's own home club (tie.homeClubId) across every played leg. */
  homeGoals: number;
  /** Aggregate goals for the tie's own away club. */
  awayGoals: number;
  legsPlayed: number;
}

/**
 * Aggregate score of a knockout tie from the tie's perspective (tie.homeClubId vs tie.awayClubId).
 * Second legs swap home/away at fixture level, so each leg's goals are credited by club id, never
 * by fixture side. Returns null until at least one leg has been played.
 */
export function aggregateTieScore(tie: { homeClubId: string; awayClubId: string }, legs: PlayedLeg[]): TieScore | null {
  let homeGoals = 0;
  let awayGoals = 0;
  let legsPlayed = 0;
  for (const leg of legs) {
    const goalsFor = (clubId: string) =>
      leg.homeClubId === clubId ? leg.homeScore : leg.awayClubId === clubId ? leg.awayScore : 0;
    homeGoals += goalsFor(tie.homeClubId);
    awayGoals += goalsFor(tie.awayClubId);
    legsPlayed += 1;
  }
  return legsPlayed > 0 ? { homeGoals, awayGoals, legsPlayed } : null;
}
