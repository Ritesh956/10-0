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

/** Maps an `overall` (70-99) to engine quality the same way packages/db/prisma/seed-real.ts does,
    so league simulations here mirror what real drafted squads actually feed the engine. */
export function overallToQuality(overall: number): number {
  return Math.min(1, Math.max(0, 0.42 + ((overall - 70) / 29) * 0.58));
}

export interface LeagueStats {
  seasons: number;
  avgChampionPoints: number;
  avgLastPoints: number;
  avgSpread: number;
  avgGoalsPerGame: number;
  strongestWinsTitlePct: number;
}

/**
 * Plays `seasons` full double round-robins over a fixed set of team overalls and aggregates
 * league-shape realism: champion/last points, the 1st-to-last spread, and how often the single
 * strongest squad actually finishes top. This is the accuracy signal individual-match win rates
 * miss — over 38 games, per-match variance can wash out quality and compress the table unless the
 * engine's quality sensitivity is tuned for it.
 */
export function simulateLeagueSeasons(overalls: number[], seasons: number): LeagueStats {
  const n = overalls.length;
  const strongest = Math.max(...overalls);
  let champPts = 0;
  let lastPts = 0;
  let spread = 0;
  let goals = 0;
  let strongestTitles = 0;

  for (let seed = 0; seed < seasons; seed++) {
    const rng = createRng(BigInt(seed * 7919 + 1));
    const pts = new Array(n).fill(0);
    const gd = new Array(n).fill(0);
    let gf = 0;
    let game = 0;
    for (let h = 0; h < n; h++) {
      for (let a = 0; a < n; a++) {
        if (h === a) continue;
        const setup = generateMatchSetup(rng, {
          matchId: `L${seed}-${game}`,
          worldId: "league",
          homeClubId: `h${h}`,
          awayClubId: `a${a}`,
          homeQuality: overallToQuality(overalls[h]!),
          awayQuality: overallToQuality(overalls[a]!),
        });
        const r = simulate(setup, BigInt(seed * 1_000_003 + game + 1));
        game++;
        gf += r.homeScore + r.awayScore;
        gd[h] += r.homeScore - r.awayScore;
        gd[a] += r.awayScore - r.homeScore;
        if (r.homeScore > r.awayScore) pts[h] += 3;
        else if (r.homeScore < r.awayScore) pts[a] += 3;
        else {
          pts[h] += 1;
          pts[a] += 1;
        }
      }
    }
    const order = [...Array(n).keys()].sort((x, y) => pts[y] - pts[x] || gd[y] - gd[x]);
    champPts += pts[order[0]!];
    lastPts += pts[order[n - 1]!];
    spread += pts[order[0]!] - pts[order[n - 1]!];
    goals += gf;
    if (overalls[order[0]!] === strongest) strongestTitles += 1;
  }

  const gamesPerSeason = n * (n - 1);
  return {
    seasons,
    avgChampionPoints: champPts / seasons,
    avgLastPoints: lastPts / seasons,
    avgSpread: spread / seasons,
    avgGoalsPerGame: goals / (seasons * gamesPerSeason),
    strongestWinsTitlePct: (strongestTitles / seasons) * 100,
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
