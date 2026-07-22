import { describe, expect, it } from "vitest";
import { formatLeaderboardResult } from "./leaderboardResult";

describe("formatLeaderboardResult", () => {
  it("formats a perfect record as the app's namesake wins-0 line", () => {
    expect(formatLeaderboardResult({ won: 38, drawn: 0, lost: 0, goalDiff: 74 })).toBe("38-0 ✨");
  });

  it("formats a near-miss record as W-D-L+GD", () => {
    expect(formatLeaderboardResult({ won: 30, drawn: 5, lost: 3, goalDiff: 42 })).toBe("30-5-3+42");
  });

  it("shows a negative goal difference without a leading plus", () => {
    expect(formatLeaderboardResult({ won: 10, drawn: 8, lost: 20, goalDiff: -19 })).toBe("10-8-20-19");
  });

  it("does not treat an all-draws record as perfect (won !== played)", () => {
    expect(formatLeaderboardResult({ won: 0, drawn: 38, lost: 0, goalDiff: 0 })).toBe("0-38-0+0");
  });
});
