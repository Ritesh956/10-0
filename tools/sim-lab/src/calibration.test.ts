import { describe, expect, it } from "vitest";
import { favoriteWinRateByGap, runBatch } from "./stats.js";

/**
 * This is the calibration harness from the architecture doc (§6): it asserts
 * the engine's aggregate behavior over many matches looks like real football,
 * not just that any single match "ran". Bounds are deliberately generous
 * (sampling noise + engine evolution) but tight enough to catch a broken model
 * (e.g. 8-goal averages, 90% draws, cards on every foul).
 */
describe("sim-lab calibration", () => {
  it("even-strength matches produce realistic scoring, results, and discipline", () => {
    const stats = runBatch({ trials: 1200, homeQuality: 0.6, awayQuality: 0.6, seedOffset: 1 });

    expect(stats.avgTotalGoals).toBeGreaterThan(2.0);
    expect(stats.avgTotalGoals).toBeLessThan(3.6);

    expect(stats.homeWinPct).toBeGreaterThan(stats.awayWinPct); // home advantage should show up
    expect(stats.homeWinPct).toBeGreaterThan(30);
    expect(stats.homeWinPct).toBeLessThan(55);
    expect(stats.drawPct).toBeGreaterThan(15);
    expect(stats.drawPct).toBeLessThan(35);

    expect(stats.highScoringPct).toBeLessThan(5); // blowout scorelines (>8 goals) should stay rare

    expect(stats.avgCardsPerMatch).toBeGreaterThan(1.5);
    expect(stats.avgCardsPerMatch).toBeLessThan(6);
    expect(stats.avgInjuriesPerMatch).toBeLessThan(1);
  });

  it("low-scoring results (0-0, 1-0, 1-1, 2-1) dominate the scoreline distribution", () => {
    const stats = runBatch({ trials: 1200, homeQuality: 0.6, awayQuality: 0.6, seedOffset: 2 });
    const commonScorelines = ["0-0", "1-0", "0-1", "1-1", "2-0", "0-2", "2-1", "1-2"];
    const commonCount = commonScorelines.reduce((sum, key) => sum + (stats.scorelineCounts[key] ?? 0), 0);
    expect(commonCount / stats.trials).toBeGreaterThan(0.55);
  });

  it("favorite win rate rises with quality gap while the underdog retains a real chance", () => {
    const points = favoriteWinRateByGap(400);
    const noGap = points[0];
    const smallGap = points[1];
    const bigGap = points[points.length - 1];
    if (!noGap || !smallGap || !bigGap) throw new Error("expected gap sweep points");

    // monotonic-ish: the biggest gap should clearly favor the stronger side more than no gap at all
    expect(bigGap.favoriteWinPct).toBeGreaterThan(noGap.favoriteWinPct + 25);
    expect(smallGap.favoriteWinPct).toBeGreaterThan(noGap.favoriteWinPct);

    // football stays unpredictable: even a big gap shouldn't make the underdog unbeatable-proof
    expect(bigGap.favoriteWinPct).toBeLessThan(95);
    expect(bigGap.underdogWinPct).toBeGreaterThan(1);

    // but a big gap should still be won by the favorite more often than not
    expect(bigGap.favoriteWinPct).toBeGreaterThan(50);
  });
});
