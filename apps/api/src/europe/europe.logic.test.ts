import { describe, expect, it } from "vitest";
import { aggregateTieScore } from "./europe.logic.js";

describe("aggregateTieScore", () => {
  const tie = { homeClubId: "a", awayClubId: "b" };

  it("sums both legs from the tie's perspective even though the second leg swaps sides", () => {
    const score = aggregateTieScore(tie, [
      { homeClubId: "a", awayClubId: "b", homeScore: 4, awayScore: 1 },
      { homeClubId: "b", awayClubId: "a", homeScore: 1, awayScore: 1 },
    ]);
    expect(score).toEqual({ homeGoals: 5, awayGoals: 2, legsPlayed: 2 });
  });

  it("handles a single-leg final", () => {
    expect(aggregateTieScore(tie, [{ homeClubId: "a", awayClubId: "b", homeScore: 1, awayScore: 0 }])).toEqual({
      homeGoals: 1,
      awayGoals: 0,
      legsPlayed: 1,
    });
  });

  it("returns null before any leg is played", () => {
    expect(aggregateTieScore(tie, [])).toBeNull();
  });
});
