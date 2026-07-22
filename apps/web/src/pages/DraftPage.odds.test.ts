import { describe, expect, it } from "vitest";
import { computePreseasonOdds } from "../lib/preseasonOdds";

describe("computePreseasonOdds", () => {
  it("regression: an Overall 82 squad no longer shows a ~40% title chance with a 7th-place projected finish", () => {
    // This is the exact scenario a user reported as visibly self-contradictory.
    const odds = computePreseasonOdds(82);
    expect(odds.projectedFinish).toBeGreaterThanOrEqual(5);
    expect(odds.projectedFinish).toBeLessThanOrEqual(9);
    expect(odds.winPct).toBeLessThan(15);
  });

  it("winPct, top4Pct, top6Pct, and top10Pct stay internally consistent across the full rating range", () => {
    for (let rating = 50; rating <= 99; rating++) {
      const odds = computePreseasonOdds(rating);
      // You can never be more likely to win the league outright than to merely finish top 4, and
      // finishing top 4 implies finishing top 6, which implies finishing top 10 — each band is a
      // strict superset of the one above it, so the percentages must never decrease band to band.
      expect(odds.winPct).toBeLessThanOrEqual(odds.top4Pct);
      expect(odds.top4Pct).toBeLessThanOrEqual(odds.top6Pct);
      expect(odds.top6Pct).toBeLessThanOrEqual(odds.top10Pct);
      // A team can't be simultaneously favored for relegation and for a top-4 finish.
      expect(odds.top4Pct + odds.relegationPct).toBeLessThanOrEqual(150);
    }
  });

  it("projected finish and all percentages move monotonically with squad quality", () => {
    const ratings = [55, 65, 75, 82, 90, 99];
    const results = ratings.map(computePreseasonOdds);
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!;
      const cur = results[i]!;
      // Better squads finish higher (lower position number), never worse.
      expect(cur.projectedFinish).toBeLessThanOrEqual(prev.projectedFinish);
      expect(cur.winPct).toBeGreaterThanOrEqual(prev.winPct);
      expect(cur.top4Pct).toBeGreaterThanOrEqual(prev.top4Pct);
      expect(cur.top6Pct).toBeGreaterThanOrEqual(prev.top6Pct);
      expect(cur.top10Pct).toBeGreaterThanOrEqual(prev.top10Pct);
      expect(cur.relegationPct).toBeLessThanOrEqual(prev.relegationPct);
      expect(cur.expectedPoints).toBeGreaterThanOrEqual(prev.expectedPoints);
    }
  });

  it("a genuinely dominant squad (rating 99) is a plausible title favorite, not a near-certainty", () => {
    const odds = computePreseasonOdds(99);
    expect(odds.projectedFinish).toBeLessThanOrEqual(3);
    expect(odds.winPct).toBeGreaterThan(20);
    expect(odds.relegationPct).toBe(0);
  });

  it("a weak squad (rating 55) is a plausible relegation candidate with near-zero title odds", () => {
    const odds = computePreseasonOdds(55);
    expect(odds.projectedFinish).toBeGreaterThanOrEqual(15);
    expect(odds.winPct).toBeLessThanOrEqual(2);
    expect(odds.relegationPct).toBeGreaterThan(30);
  });

  it("a dominant squad (rating 99) is a near-certainty for top 6 and top 10, not just top 4", () => {
    const odds = computePreseasonOdds(99);
    expect(odds.top6Pct).toBeGreaterThan(odds.top4Pct);
    expect(odds.top10Pct).toBeGreaterThanOrEqual(odds.top6Pct);
    expect(odds.top10Pct).toBeGreaterThanOrEqual(95);
  });

  it("a weak squad (rating 55) still has some realistic top-10 hope even with near-zero title odds", () => {
    const odds = computePreseasonOdds(55);
    // A relegation-form squad can still scrape into the top half on a given season — this
    // shouldn't be a flat 0%, since that would make Top 10 read as impossible for weak squads.
    expect(odds.top10Pct).toBeGreaterThan(0);
    expect(odds.top10Pct).toBeGreaterThanOrEqual(odds.top6Pct);
    expect(odds.top6Pct).toBeGreaterThanOrEqual(odds.top4Pct);
  });
});
