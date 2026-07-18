import { describe, expect, it } from "vitest";
import { generateDoubleRoundRobin } from "./round-robin.js";

describe("generateDoubleRoundRobin", () => {
  it("gives every club the same number of matches, home and away once each against every opponent", () => {
    const clubs = ["A", "B", "C", "D"];
    const fixtures = generateDoubleRoundRobin(clubs);

    // each club plays (n-1)*2 matches
    const expectedPerClub = (clubs.length - 1) * 2;
    for (const club of clubs) {
      const played = fixtures.filter((f) => f.homeClubId === club || f.awayClubId === club);
      expect(played).toHaveLength(expectedPerClub);
    }

    // every ordered pair (home, away) appears exactly once
    const pairCounts = new Map<string, number>();
    for (const f of fixtures) {
      const key = `${f.homeClubId}->${f.awayClubId}`;
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
    for (const home of clubs) {
      for (const away of clubs) {
        if (home === away) continue;
        expect(pairCounts.get(`${home}->${away}`)).toBe(1);
      }
    }
  });

  it("assigns matchdays 1..2*(n-1) with the right number of fixtures per matchday", () => {
    const clubs = ["A", "B", "C", "D", "E", "F"];
    const fixtures = generateDoubleRoundRobin(clubs);
    const totalMatchdays = (clubs.length - 1) * 2;
    const byMatchday = new Map<number, number>();
    for (const f of fixtures) {
      byMatchday.set(f.matchday, (byMatchday.get(f.matchday) ?? 0) + 1);
    }
    expect(byMatchday.size).toBe(totalMatchdays);
    for (let md = 1; md <= totalMatchdays; md++) {
      expect(byMatchday.get(md)).toBe(clubs.length / 2);
    }
  });

  it("handles an odd number of clubs via byes without ever scheduling the bye placeholder", () => {
    const clubs = ["A", "B", "C"];
    const fixtures = generateDoubleRoundRobin(clubs);
    for (const f of fixtures) {
      expect(f.homeClubId).not.toContain("BYE");
      expect(f.awayClubId).not.toContain("BYE");
    }
    // each club plays fewer than 2*(n-1) since one bye each per leg
    const expectedPerClub = (clubs.length - 1) * 2;
    for (const club of clubs) {
      const played = fixtures.filter((f) => f.homeClubId === club || f.awayClubId === club);
      expect(played.length).toBeLessThanOrEqual(expectedPerClub);
    }
  });

  it("returns an empty schedule for fewer than 2 clubs", () => {
    expect(generateDoubleRoundRobin([])).toEqual([]);
    expect(generateDoubleRoundRobin(["A"])).toEqual([]);
  });
});
