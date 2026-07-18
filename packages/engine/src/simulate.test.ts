import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";
import { simulate } from "./simulate.js";
import { generateMatchSetup } from "./testing/fixtures.js";

function buildSetup(seed: bigint, homeQuality: number, awayQuality: number) {
  const rng = createRng(seed);
  return generateMatchSetup(rng, {
    matchId: "match-1",
    worldId: "world-1",
    homeClubId: "home-fc",
    awayClubId: "away-fc",
    homeQuality,
    awayQuality,
  });
}

describe("simulate", () => {
  it("is a pure function of (setup, seed): identical inputs produce identical output", () => {
    const setup = buildSetup(42n, 0.7, 0.6);
    const resultA = simulate(setup, 12345n);
    const resultB = simulate(setup, 12345n);
    expect(resultB).toEqual(resultA);
  });

  it("produces different outcomes for different seeds on the same setup", () => {
    const setup = buildSetup(42n, 0.7, 0.6);
    const resultA = simulate(setup, 1n);
    const resultB = simulate(setup, 2n);
    expect(resultA).not.toEqual(resultB);
  });

  it("emits a full-time event whose score matches the returned result", () => {
    const setup = buildSetup(7n, 0.6, 0.6);
    const result = simulate(setup, 999n);
    const fullTime = result.events.find((e) => e.type === "full-time");
    expect(fullTime).toBeDefined();
    if (fullTime?.type === "full-time") {
      expect(fullTime.homeScore).toBe(result.homeScore);
      expect(fullTime.awayScore).toBe(result.awayScore);
    }
  });

  it("keeps event seq strictly increasing and minute within [0,90]", () => {
    const setup = buildSetup(3n, 0.5, 0.5);
    const result = simulate(setup, 55n);
    for (let i = 0; i < result.events.length; i++) {
      const event = result.events[i]!;
      expect(event.seq).toBe(i);
      expect(event.minute).toBeGreaterThanOrEqual(0);
      expect(event.minute).toBeLessThanOrEqual(90);
    }
  });

  it("possession splits sum to 1 and xG/score are non-negative", () => {
    const setup = buildSetup(9n, 0.65, 0.55);
    const result = simulate(setup, 321n);
    expect(result.homePossession + result.awayPossession).toBeCloseTo(1, 5);
    expect(result.homeXg).toBeGreaterThanOrEqual(0);
    expect(result.awayXg).toBeGreaterThanOrEqual(0);
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
  });

  it("a significantly stronger squad wins more often than a much weaker one over many matches", () => {
    let strongWins = 0;
    let weakWins = 0;
    const trials = 150;
    for (let i = 0; i < trials; i++) {
      const setup = buildSetup(BigInt(i + 1), 0.85, 0.25);
      const result = simulate(setup, BigInt(i * 1000 + 1));
      if (result.homeScore > result.awayScore) strongWins++;
      else if (result.awayScore > result.homeScore) weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins * 2);
  });

  it("records goals and full-time score consistently with per-player goal contributions", () => {
    const setup = buildSetup(15n, 0.7, 0.4);
    const result = simulate(setup, 4242n);
    const totalPlayerGoals = result.playerStats.reduce((sum, p) => sum + p.goals, 0);
    expect(totalPlayerGoals).toBe(result.homeScore + result.awayScore);
  });
});
