import { describe, expect, it } from "vitest";
import type { KnockoutTieDto } from "../api/types";
import { pendingRound, roundPlayed } from "./NationsCupPanel";

const tie = (round: KnockoutTieDto["round"], over: Partial<KnockoutTieDto> = {}): KnockoutTieDto => ({
  id: `${round}-${Math.random()}`,
  round,
  homeClubId: "a",
  awayClubId: "b",
  firstLegFixtureId: null,
  secondLegFixtureId: null,
  winnerClubId: null,
  wentToPenalties: false,
  score: null,
  ...over,
});

describe("Nations Cup progress helpers", () => {
  it("finds the first round with an undecided tie", () => {
    expect(pendingRound([])).toBeNull();
    expect(pendingRound([tie("QF"), tie("QF")])).toBe("QF");
    expect(pendingRound([tie("QF", { winnerClubId: "a" }), tie("SF")])).toBe("SF");
    expect(pendingRound([tie("QF", { winnerClubId: "a" }), tie("SF", { winnerClubId: "a" }), tie("FINAL", { winnerClubId: "a" })])).toBeNull();
  });

  it("a round is played once every tie has a score", () => {
    const score = { homeGoals: 1, awayGoals: 0, legsPlayed: 1 };
    expect(roundPlayed([tie("QF", { score }), tie("QF", { score: null })], "QF")).toBe(false);
    expect(roundPlayed([tie("QF", { score }), tie("QF", { score })], "QF")).toBe(true);
    expect(roundPlayed([], "QF")).toBe(false);
  });
});
