import { createRng, simulate } from "@futbol/engine";
import { generateMatchSetup } from "@futbol/engine/testing";

export interface BatchConfig {
  trials: number;
  homeQuality: number;
  awayQuality: number;
  seedOffset?: number;
}

export interface BatchStats {
  trials: number;
  avgTotalGoals: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  highScoringPct: number;
  avgCardsPerMatch: number;
  avgInjuriesPerMatch: number;
  scorelineCounts: Record<string, number>;
}

/** Runs `trials` independent matches for a fixed quality matchup and aggregates realism-relevant stats. */
export function runBatch(config: BatchConfig): BatchStats {
  const { trials, homeQuality, awayQuality, seedOffset = 0 } = config;
  let totalGoals = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let highScoring = 0;
  let totalCards = 0;
  let totalInjuries = 0;
  const scorelineCounts: Record<string, number> = {};

  const setupRng = createRng(BigInt(seedOffset + 1));

  for (let i = 0; i < trials; i++) {
    const setup = generateMatchSetup(setupRng, {
      matchId: `calib-${seedOffset}-${i}`,
      worldId: "calibration",
      homeClubId: "home",
      awayClubId: "away",
      homeQuality,
      awayQuality,
    });
    const result = simulate(setup, BigInt(seedOffset + i + 1_000_000));

    totalGoals += result.homeScore + result.awayScore;
    homeGoals += result.homeScore;
    awayGoals += result.awayScore;
    if (result.homeScore > result.awayScore) homeWins += 1;
    else if (result.homeScore < result.awayScore) awayWins += 1;
    else draws += 1;
    if (result.homeScore + result.awayScore > 8) highScoring += 1;

    for (const event of result.events) {
      if (event.type === "card") totalCards += 1;
      if (event.type === "injury") totalInjuries += 1;
    }

    const key = `${result.homeScore}-${result.awayScore}`;
    scorelineCounts[key] = (scorelineCounts[key] ?? 0) + 1;
  }

  return {
    trials,
    avgTotalGoals: totalGoals / trials,
    avgHomeGoals: homeGoals / trials,
    avgAwayGoals: awayGoals / trials,
    homeWinPct: (homeWins / trials) * 100,
    drawPct: (draws / trials) * 100,
    awayWinPct: (awayWins / trials) * 100,
    highScoringPct: (highScoring / trials) * 100,
    avgCardsPerMatch: totalCards / trials,
    avgInjuriesPerMatch: totalInjuries / trials,
    scorelineCounts,
  };
}

export interface GapPoint {
  gap: number;
  favoriteWinPct: number;
  drawPct: number;
  underdogWinPct: number;
}

/** Sweeps quality gaps between two sides to check that stronger squads win more often without being unbeatable. */
export function favoriteWinRateByGap(trialsPerGap: number, gaps: number[] = [0, 0.1, 0.2, 0.3, 0.4]): GapPoint[] {
  return gaps.map((gap) => {
    const stats = runBatch({
      trials: trialsPerGap,
      homeQuality: 0.6 + gap / 2,
      awayQuality: 0.6 - gap / 2,
      seedOffset: Math.round(gap * 1000) + 5000,
    });
    return {
      gap,
      favoriteWinPct: stats.homeWinPct,
      drawPct: stats.drawPct,
      underdogWinPct: stats.awayWinPct,
    };
  });
}
