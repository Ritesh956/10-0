import { favoriteWinRateByGap, runBatch } from "./stats.js";

const even = runBatch({ trials: 1500, homeQuality: 0.6, awayQuality: 0.6, seedOffset: 1 });
console.log("=== Even strength (0.6 vs 0.6), 1500 trials ===");
console.log(`avg total goals: ${even.avgTotalGoals.toFixed(2)} (home ${even.avgHomeGoals.toFixed(2)}, away ${even.avgAwayGoals.toFixed(2)})`);
console.log(`home win %: ${even.homeWinPct.toFixed(1)}  draw %: ${even.drawPct.toFixed(1)}  away win %: ${even.awayWinPct.toFixed(1)}`);
console.log(`high-scoring (>8 goals) %: ${even.highScoringPct.toFixed(2)}`);
console.log(`avg cards/match: ${even.avgCardsPerMatch.toFixed(2)}  avg injuries/match: ${even.avgInjuriesPerMatch.toFixed(3)}`);
const topScorelines = Object.entries(even.scorelineCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log("top scorelines:", topScorelines.map(([k, v]) => `${k}:${v}`).join(", "));

console.log("\n=== Favorite win rate by quality gap, 500 trials/gap ===");
const gaps = favoriteWinRateByGap(500);
for (const g of gaps) {
  console.log(
    `gap ${g.gap.toFixed(2)}: favorite ${g.favoriteWinPct.toFixed(1)}%  draw ${g.drawPct.toFixed(1)}%  underdog ${g.underdogWinPct.toFixed(1)}%`,
  );
}
