import { describe, expect, it } from "vitest";
import { computeCompletionOdds, type CompletionOddsInput } from "./dailyOdds";
import type { DailyConstraintDto } from "../api/types";

const nationalityConstraint: DailyConstraintDto = {
  type: "nationality",
  value: "Brazil",
  label: "Brazil",
  required: 2,
  description: "2 other Brazil players",
};
const clubConstraint: DailyConstraintDto = {
  type: "club",
  value: "club-a",
  label: "Alpha FC",
  required: 1,
  description: "1 other player whose featured season was at Alpha FC",
};

function baseInput(overrides: Partial<CompletionOddsInput> = {}): CompletionOddsInput {
  return {
    openSlots: 8,
    totalRemaining: 5000,
    constraints: [nationalityConstraint, clubConstraint],
    matchedByConstraint: [0, 0],
    eligibleRemainingByConstraint: [200, 100],
    ...overrides,
  };
}

describe("computeCompletionOdds", () => {
  it("returns 100 once every constraint is already met", () => {
    const odds = computeCompletionOdds(baseInput({ matchedByConstraint: [2, 1] }));
    expect(odds).toBe(100);
  });

  it("returns 0 when a constraint needs more matches than there are open slots left", () => {
    const odds = computeCompletionOdds(baseInput({ openSlots: 0, matchedByConstraint: [0, 0] }));
    expect(odds).toBe(0);
  });

  it("returns 0 when the eligible pool for an unmet constraint is exhausted", () => {
    const odds = computeCompletionOdds(baseInput({ eligibleRemainingByConstraint: [0, 100] }));
    expect(odds).toBe(0);
  });

  it("stays within [0, 100]", () => {
    for (const openSlots of [0, 1, 5, 11]) {
      for (const eligible of [0, 1, 50, 5000]) {
        const odds = computeCompletionOdds(baseInput({ openSlots, eligibleRemainingByConstraint: [eligible, eligible] }));
        expect(odds).toBeGreaterThanOrEqual(0);
        expect(odds).toBeLessThanOrEqual(100);
      }
    }
  });

  it("increases (or stays equal) as more open slots remain, all else equal", () => {
    const odds5 = computeCompletionOdds(baseInput({ openSlots: 5 }));
    const odds8 = computeCompletionOdds(baseInput({ openSlots: 8 }));
    const odds11 = computeCompletionOdds(baseInput({ openSlots: 11 }));
    expect(odds5).toBeLessThanOrEqual(odds8);
    expect(odds8).toBeLessThanOrEqual(odds11);
  });

  it("increases (or stays equal) as the eligible pool for an unmet constraint grows", () => {
    const small = computeCompletionOdds(baseInput({ eligibleRemainingByConstraint: [20, 100] }));
    const medium = computeCompletionOdds(baseInput({ eligibleRemainingByConstraint: [200, 100] }));
    const large = computeCompletionOdds(baseInput({ eligibleRemainingByConstraint: [2000, 100] }));
    expect(small).toBeLessThanOrEqual(medium);
    expect(medium).toBeLessThanOrEqual(large);
  });

  it("increases (or stays equal) as fewer additional matches are still needed", () => {
    const needsTwo = computeCompletionOdds(baseInput({ matchedByConstraint: [0, 0] }));
    const needsOne = computeCompletionOdds(baseInput({ matchedByConstraint: [1, 0] }));
    const needsNone = computeCompletionOdds(baseInput({ matchedByConstraint: [2, 0] }));
    expect(needsTwo).toBeLessThanOrEqual(needsOne);
    expect(needsOne).toBeLessThanOrEqual(needsNone);
  });

  it("treats a constraint list with a zero requirement as always satisfied", () => {
    const zeroReq: DailyConstraintDto = { ...nationalityConstraint, required: 0 };
    const odds = computeCompletionOdds(
      baseInput({ constraints: [zeroReq], matchedByConstraint: [0], eligibleRemainingByConstraint: [0] }),
    );
    expect(odds).toBe(100);
  });
});
