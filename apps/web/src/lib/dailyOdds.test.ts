import { describe, expect, it } from "vitest";
import { boostedDrawIds, computeCompletionOdds, DAILY_BOOST_SHARE, offerChances, type CompletionOddsInput } from "./dailyOdds";
import type { DailyConstraintDto, DailyPoolStatsDto } from "../api/types";

const nationalityConstraint: DailyConstraintDto = {
  type: "nationality",
  value: "Brazil",
  label: "Brazil",
  required: 2,
  description: "2 other Brazilian players",
};
const clubConstraint: DailyConstraintDto = {
  type: "club",
  value: "club-a",
  label: "Alpha FC",
  required: 1,
  description: "1 other Alpha FC player",
};
const constraints = [nationalityConstraint, clubConstraint];

/** 1,300 club-seasons: Brazilians in 400 of them, the brief's club in 10 — a typical real daily. */
const drawPool = new Set(Array.from({ length: 1300 }, (_, i) => `cs-${i}`));
const poolStats: DailyPoolStatsDto = {
  totalPlayers: 9000,
  eligiblePerConstraint: [300, 25],
  clubSeasonIdsPerConstraint: [Array.from({ length: 400 }, (_, i) => `cs-${i}`), Array.from({ length: 10 }, (_, i) => `cs-${1290 + i}`)],
};

function input(overrides: Partial<CompletionOddsInput> = {}): CompletionOddsInput {
  const matched = overrides.matchedByConstraint ?? [0, 0];
  return {
    openSlots: 10,
    rerollsRemaining: 3,
    constraints,
    matchedByConstraint: matched,
    offerChance: offerChances(constraints, matched, poolStats, drawPool),
    ...overrides,
  };
}

describe("computeCompletionOdds", () => {
  it("regression: a fresh daily with a rare club brief no longer starts at 0%", () => {
    const odds = computeCompletionOdds(input());
    expect(odds).toBeGreaterThan(50);
    expect(odds).toBeLessThan(100);
  });

  it("returns 100 once every requirement is met, 0 once one can't be met in the slots left", () => {
    expect(computeCompletionOdds(input({ matchedByConstraint: [2, 1] }))).toBe(100);
    expect(computeCompletionOdds(input({ openSlots: 1, matchedByConstraint: [0, 0] }))).toBe(0);
    expect(computeCompletionOdds(input({ openSlots: 0 }))).toBe(0);
  });

  it("rises as requirements get banked and falls as slots run out", () => {
    const fresh = computeCompletionOdds(input());
    const oneBanked = computeCompletionOdds(input({ matchedByConstraint: [1, 0] }));
    const fewSlots = computeCompletionOdds(input({ openSlots: 4 }));
    expect(oneBanked).toBeGreaterThanOrEqual(fresh);
    expect(fewSlots).toBeLessThan(fresh);
  });

  it("rerolls help, never hurt", () => {
    expect(computeCompletionOdds(input({ rerollsRemaining: 3 }))).toBeGreaterThanOrEqual(computeCompletionOdds(input({ rerollsRemaining: 0 })));
  });

  it("stays within [0, 100] across the whole state space", () => {
    for (let openSlots = 0; openSlots <= 11; openSlots++) {
      for (const offer of [0, 0.01, 0.3, 1]) {
        const odds = computeCompletionOdds(input({ openSlots, offerChance: [offer, offer] }));
        expect(odds).toBeGreaterThanOrEqual(0);
        expect(odds).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("offerChances", () => {
  it("adds the boosted share for unmet requirements on top of the natural draw rate", () => {
    const [nat, club] = offerChances(constraints, [0, 0], poolStats, drawPool);
    expect(club).toBeCloseTo(DAILY_BOOST_SHARE / 2 + (1 - DAILY_BOOST_SHARE) * (10 / 1300), 5);
    expect(nat).toBeGreaterThan(club!);
  });

  it("stops boosting a requirement once it's met", () => {
    const [nat] = offerChances(constraints, [2, 0], poolStats, drawPool);
    expect(nat).toBeCloseTo((1 - DAILY_BOOST_SHARE) * (400 / 1300), 5);
  });
});

describe("boostedDrawIds", () => {
  it("draws from an unmet requirement's club-seasons on a boosted spin, and from everything otherwise", () => {
    expect(boostedDrawIds(constraints, [2, 0], poolStats, drawPool, () => 0)).toHaveLength(10);
    expect(boostedDrawIds(constraints, [0, 0], poolStats, drawPool, () => 0.99)).toBeNull();
    expect(boostedDrawIds(constraints, [2, 1], poolStats, drawPool, () => 0)).toBeNull();
  });
});
