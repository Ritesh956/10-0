import { describe, expect, it } from "vitest";
import { favoriteWinRateByGap, runBatch, simulateLeagueSeasons } from "./stats.js";
import { buildAiLeague, loadRealCatalog, rateCatalog, tableShape } from "./real-league.js";

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

  it("a full league season produces a realistic table, not a compressed one", () => {
    // A realistic top-league spread of XI overalls on the 2026-10 rating curve (elite ~86 down to
    // relegation ~70 — the span the real LaLiga/Serie A fields actually have in the dataset).
    const overalls = [86, 85, 84, 83, 82, 81, 80, 79, 79, 78, 77, 77, 76, 75, 74, 74, 73, 72, 71, 70];
    const stats = simulateLeagueSeasons(overalls, 12);

    // The champion must pull clear of the pack — a compressed table (everyone bunched ~60-75 pts)
    // was the symptom of quality washing out over 38 games. Real title totals sit ~80-95.
    expect(stats.avgChampionPoints).toBeGreaterThan(78);
    expect(stats.avgChampionPoints).toBeLessThan(98);

    // 1st-to-last spread should look like a real division (~55-70), not a flat ~45.
    expect(stats.avgSpread).toBeGreaterThan(48);

    // Quality must translate to standings: the single strongest squad should win the title far more
    // often than the 1-in-20 a coin-flip league would give — while still leaving room for upsets.
    expect(stats.strongestWinsTitlePct).toBeGreaterThan(40);
    expect(stats.strongestWinsTitlePct).toBeLessThan(90);

    // Season-long scoring stays realistic.
    expect(stats.avgGoalsPerGame).toBeGreaterThan(2.3);
    expect(stats.avgGoalsPerGame).toBeLessThan(3.2);
  }, 30000);

  it("the real leagues, as the game actually builds them, produce real-looking tables", () => {
    // AI clubs exactly as the live season fills them (latest real season, best XI) with the seeded
    // attributes and the worker's fitness rules — the table the player actually plays in. This is the
    // check that caught the flat tables (champion ~68, ρ ~0.6) before the 2026-10 re-fit.
    const catalog = loadRealCatalog();
    const rated = rateCatalog(catalog);
    for (const leagueId of ["league-es1", "league-it1"]) {
      const shape = tableShape(buildAiLeague(catalog, rated, leagueId), 4);
      expect(shape.avgChampionPoints).toBeGreaterThan(76);
      expect(shape.avgChampionPoints).toBeLessThan(100);
      expect(shape.avgSafetyPoints).toBeGreaterThan(26);
      expect(shape.avgSafetyPoints).toBeLessThan(46);
      // Finishing position should strongly track squad strength (1 = perfectly by overall).
      expect(shape.avgStrengthRankCorrelation).toBeGreaterThan(0.7);
      expect(shape.goalsPerGame).toBeGreaterThan(2.2);
      expect(shape.goalsPerGame).toBeLessThan(3.4);
    }
  }, 60000);
});
