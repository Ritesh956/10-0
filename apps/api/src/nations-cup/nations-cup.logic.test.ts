import { describe, expect, it } from "vitest";
import { drawGroups, groupFixtures, groupsFromFixtures, quarterFinalPairs, seedNations } from "./nations-cup.logic.js";

const sides = Array.from({ length: 16 }, (_, i) => ({ clubId: `n${String(i).padStart(2, "0")}`, strength: 90 - i }));

describe("seedNations / drawGroups", () => {
  it("seeds strongest first", () => {
    const seeded = seedNations([...sides].reverse());
    expect(seeded[0]!.clubId).toBe("n00");
    expect(seeded[15]!.seed).toBe(16);
  });

  it("puts one side from each pot in every group", () => {
    const seeded = seedNations(sides);
    const groups = drawGroups(seeded, 99);
    expect(groups).toHaveLength(4);
    const seedOf = new Map(seeded.map((s) => [s.clubId, s.seed]));
    for (const g of groups) {
      expect(g).toHaveLength(4);
      expect(g.map((id) => Math.ceil(seedOf.get(id)! / 4)).sort()).toEqual([1, 2, 3, 4]);
    }
    expect(new Set(groups.flat()).size).toBe(16);
  });

  it("is deterministic for a seed but varies between seeds", () => {
    const seeded = seedNations(sides);
    expect(drawGroups(seeded, 5)).toEqual(drawGroups(seeded, 5));
    const draws = new Set(Array.from({ length: 10 }, (_, i) => JSON.stringify(drawGroups(seeded, i))));
    expect(draws.size).toBeGreaterThan(5);
  });

  it("needs exactly sixteen sides", () => {
    expect(() => drawGroups(seedNations(sides.slice(0, 12)), 1)).toThrow();
  });
});

describe("group fixtures", () => {
  const groups = drawGroups(seedNations(sides), 3);
  const fixtures = groupFixtures(groups);

  it("plays every pair in a group once over three matchdays", () => {
    expect(fixtures).toHaveLength(24);
    const keys = fixtures.map((f) => [f.homeClubId, f.awayClubId].sort().join("|"));
    expect(new Set(keys).size).toBe(24);
    for (const day of [1, 2, 3]) {
      const clubs = fixtures.filter((f) => f.matchday === day).flatMap((f) => [f.homeClubId, f.awayClubId]);
      expect(new Set(clubs).size).toBe(16); // everyone plays exactly once a matchday
    }
  });

  it("recovers the same groups from the fixtures alone", () => {
    const recovered = groupsFromFixtures(fixtures);
    expect(recovered).toHaveLength(4);
    expect(recovered.map((g) => [...g].sort())).toEqual(
      [...groups.map((g) => [...g].sort())].sort((a, b) => a[0]!.localeCompare(b[0]!)),
    );
  });
});

describe("quarterFinalPairs", () => {
  it("sends winners against the other half's runners-up", () => {
    const pairs = quarterFinalPairs([
      { winner: "A1", runnerUp: "A2" },
      { winner: "B1", runnerUp: "B2" },
      { winner: "C1", runnerUp: "C2" },
      { winner: "D1", runnerUp: "D2" },
    ]);
    expect(pairs).toEqual([
      ["A1", "B2"],
      ["C1", "D2"],
      ["B1", "A2"],
      ["D1", "C2"],
    ]);
    // No one meets a side from their own group.
    for (const [x, y] of pairs) expect(x![0]).not.toBe(y![0]);
  });
});
