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

import { summarizeEuropeRun } from "./europe.logic.js";

describe("summarizeEuropeRun", () => {
  const countryOf = (id: string) => ({ a: "Spain", b: "Italy", c: "Spain", d: "France" })[id];

  it("counts the league-phase record and the leagues whose clubs were beaten", () => {
    const summary = summarizeEuropeRun({
      leaguePhaseMatches: [
        { opponentClubId: "a", goalsFor: 2, goalsAgainst: 0 },
        { opponentClubId: "b", goalsFor: 1, goalsAgainst: 1 },
        { opponentClubId: "d", goalsFor: 0, goalsAgainst: 3 },
      ],
      leaguePhaseRank: 12,
      knockoutMatches: [{ opponentClubId: "c", goalsFor: 3, goalsAgainst: 1 }],
      countryOf,
    });
    expect(summary.leaguePhase).toEqual({ played: 3, won: 1, drawn: 1, lost: 1, rank: 12 });
    expect(summary.countriesBeaten).toEqual(["Spain"]);
  });

  it("has no league phase for a straight knockout cup", () => {
    const summary = summarizeEuropeRun({ leaguePhaseMatches: null, leaguePhaseRank: null, knockoutMatches: [], countryOf });
    expect(summary.leaguePhase).toBeNull();
    expect(summary.countriesBeaten).toEqual([]);
  });
});
