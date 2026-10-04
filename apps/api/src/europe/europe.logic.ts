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

/** One match the user's club played, from the user's own point of view. */
export interface RunMatch {
  opponentClubId: string;
  goalsFor: number;
  goalsAgainst: number;
}

export interface EuropeRunSummary {
  /** Null for a competition with no league phase (the Continental Cup). */
  leaguePhase: { played: number; won: number; drawn: number; lost: number; rank: number | null } | null;
  /** Home countries of every club the user beat in a match, league phase or knockout. */
  countriesBeaten: string[];
}

/**
 * Reduces the user's European matches to what the trophies read: the league-phase record and finish,
 * and which leagues' clubs they've beaten. Pure — the caller supplies the matches and a country lookup.
 */
export function summarizeEuropeRun(input: {
  leaguePhaseMatches: RunMatch[] | null;
  leaguePhaseRank: number | null;
  knockoutMatches: RunMatch[];
  countryOf: (clubId: string) => string | undefined;
}): EuropeRunSummary {
  const beaten = new Set<string>();
  for (const m of [...(input.leaguePhaseMatches ?? []), ...input.knockoutMatches]) {
    if (m.goalsFor > m.goalsAgainst) {
      const country = input.countryOf(m.opponentClubId);
      if (country) beaten.add(country);
    }
  }
  let leaguePhase: EuropeRunSummary["leaguePhase"] = null;
  if (input.leaguePhaseMatches) {
    const ms = input.leaguePhaseMatches;
    leaguePhase = {
      played: ms.length,
      won: ms.filter((m) => m.goalsFor > m.goalsAgainst).length,
      drawn: ms.filter((m) => m.goalsFor === m.goalsAgainst).length,
      lost: ms.filter((m) => m.goalsFor < m.goalsAgainst).length,
      rank: input.leaguePhaseRank,
    };
  }
  return { leaguePhase, countriesBeaten: [...beaten] };
}
