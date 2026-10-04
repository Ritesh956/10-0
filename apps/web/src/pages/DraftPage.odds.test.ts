import { describe, expect, it } from "vitest";
import { computePreseasonOdds } from "../lib/preseasonOdds";
import { PROJECTION_TABLE } from "../lib/projectionTable";

const LEAGUES = Object.keys(PROJECTION_TABLE);

describe("computePreseasonOdds", () => {
  it("regression (B20): expected points always look like the projected finish", () => {
    // The old curve projected an Overall-90 XI "4th, 89 pts" while simulated champions finished on
    // ~69, so the projection disagreed with the engine. It's now read off simulated seasons, so a
    // squad projected outside the title race can't also be credited with title-winning points.
    for (const leagueId of LEAGUES) {
      for (let overall = 62; overall <= 94; overall++) {
        const odds = computePreseasonOdds(overall, leagueId);
        if (odds.projectedFinish >= 4) expect(odds.expectedPoints).toBeLessThan(80);
        if (odds.projectedFinish >= 10) expect(odds.expectedPoints).toBeLessThan(60);
      }
    }
  });

  it("an XI that projects mid-table doesn't also show a big title chance", () => {
    const odds = computePreseasonOdds(82, "league-gb1");
    expect(odds.projectedFinish).toBeGreaterThanOrEqual(8);
    expect(odds.projectedFinish).toBeLessThanOrEqual(12);
    expect(odds.winPct).toBeLessThan(10);
  });

  it("win <= top 4 <= top 6 <= top 10 in every league across the whole rating range", () => {
    for (const leagueId of LEAGUES) {
      for (let rating = 50; rating <= 99; rating++) {
        const odds = computePreseasonOdds(rating, leagueId);
        expect(odds.winPct).toBeLessThanOrEqual(odds.top4Pct);
        expect(odds.top4Pct).toBeLessThanOrEqual(odds.top6Pct);
        expect(odds.top6Pct).toBeLessThanOrEqual(odds.top10Pct);
        expect(odds.top4Pct + odds.relegationPct).toBeLessThanOrEqual(150);
      }
    }
  });

  it("everything moves monotonically with squad quality", () => {
    for (const leagueId of LEAGUES) {
      let prev = computePreseasonOdds(60, leagueId);
      for (let rating = 61; rating <= 96; rating++) {
        const cur = computePreseasonOdds(rating, leagueId);
        expect(cur.projectedFinish).toBeLessThanOrEqual(prev.projectedFinish);
        expect(cur.winPct).toBeGreaterThanOrEqual(prev.winPct);
        expect(cur.top4Pct).toBeGreaterThanOrEqual(prev.top4Pct);
        expect(cur.top10Pct).toBeGreaterThanOrEqual(prev.top10Pct);
        expect(cur.relegationPct).toBeLessThanOrEqual(prev.relegationPct);
        expect(cur.expectedPoints).toBeGreaterThanOrEqual(prev.expectedPoints);
        prev = cur;
      }
    }
  });

  it("an elite XI is the title favourite but never a certainty; a weak one is relegation fodder", () => {
    const elite = computePreseasonOdds(92, "league-gb1");
    expect(elite.projectedFinish).toBe(1);
    expect(elite.winPct).toBeGreaterThan(50);
    expect(elite.winPct).toBeLessThanOrEqual(99);
    expect(elite.relegationPct).toBe(0);

    const weak = computePreseasonOdds(72, "league-gb1");
    expect(weak.projectedFinish).toBeGreaterThanOrEqual(17);
    expect(weak.winPct).toBe(0);
    expect(weak.relegationPct).toBeGreaterThan(50);
  });

  it("uses each league's real size and falls back to the Premier League for an unknown league", () => {
    expect(computePreseasonOdds(80, "league-l1").seasonSize).toBe(18);
    expect(computePreseasonOdds(80, "league-es1").seasonSize).toBe(20);
    expect(computePreseasonOdds(80, "not-a-league")).toEqual(computePreseasonOdds(80, "league-gb1"));
    expect(computePreseasonOdds(80)).toEqual(computePreseasonOdds(80, "league-gb1"));
  });

  it("interpolates between simulated buckets instead of jumping", () => {
    const a = computePreseasonOdds(84, "league-gb1").expectedPoints;
    const b = computePreseasonOdds(85, "league-gb1").expectedPoints;
    const c = computePreseasonOdds(86, "league-gb1").expectedPoints;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
