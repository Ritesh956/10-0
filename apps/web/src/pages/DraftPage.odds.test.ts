import { describe, expect, it } from "vitest";
import { computePreseasonOdds } from "./DraftPage";

describe("computePreseasonOdds", () => {
  it("regression: an Overall 82 squad no longer shows a ~40% title chance with a 7th-place projected finish", () => {
    // This is the exact scenario a user reported as visibly self-contradictory.
    const odds = computePreseasonOdds(82);
    expect(odds.projectedFinish).toBeGreaterThanOrEqual(5);
    expect(odds.projectedFinish).toBeLessThanOrEqual(9);
    expect(odds.winPct).toBeLessThan(15);
  });

  it("winPct and top4Pct stay internally consistent across the full rating range", () => {
    for (let rating = 50; rating <= 99; rating++) {
      const odds = computePreseasonOdds(rating);
      // You can never be more likely to win the league outright than to merely finish top 4.
      expect(odds.winPct).toBeLessThanOrEqual(odds.top4Pct);
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
});
