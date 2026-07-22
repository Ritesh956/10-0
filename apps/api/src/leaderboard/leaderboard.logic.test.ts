import { describe, expect, it } from "vitest";
import { evaluateClubRecordTrophies, formatLeaderboardResult, resolveTimeWindowCutoff } from "./leaderboard.logic.js";

describe("resolveTimeWindowCutoff", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");

  it("returns undefined for 'all' (no lower bound)", () => {
    expect(resolveTimeWindowCutoff("all", now)).toBeUndefined();
  });

  it("returns exactly 1 day back for 'today'", () => {
    expect(resolveTimeWindowCutoff("today", now)).toEqual(new Date("2026-07-21T12:00:00.000Z"));
  });

  it("returns exactly 7 days back for 'week'", () => {
    expect(resolveTimeWindowCutoff("week", now)).toEqual(new Date("2026-07-15T12:00:00.000Z"));
  });
});

describe("formatLeaderboardResult", () => {
  it("formats a perfect record as the app's namesake wins-0 line", () => {
    expect(formatLeaderboardResult({ played: 38, won: 38, drawn: 0, lost: 0, goalDiff: 74 })).toBe("38-0 ✨");
  });

  it("formats a near-miss record as W-D-L+GD", () => {
    expect(formatLeaderboardResult({ played: 38, won: 30, drawn: 5, lost: 3, goalDiff: 42 })).toBe("30-5-3+42");
  });

  it("shows a negative goal difference without a leading plus", () => {
    expect(formatLeaderboardResult({ played: 38, won: 10, drawn: 8, lost: 20, goalDiff: -19 })).toBe("10-8-20-19");
  });

  it("does not treat an empty (0-played) record as perfect", () => {
    expect(formatLeaderboardResult({ played: 0, won: 0, drawn: 0, lost: 0, goalDiff: 0 })).toBe("0-0-0+0");
  });
});

describe("evaluateClubRecordTrophies", () => {
  it("awards nothing for the very first submission for a club (no prior entries to compare)", () => {
    expect(evaluateClubRecordTrophies(95, [])).toEqual([]);
  });

  it("awards club-record-breaker for a new all-time-high points total", () => {
    expect(evaluateClubRecordTrophies(100, [95, 80, 60])).toEqual(["club-record-breaker"]);
  });

  it("awards club-worst-ever for a new all-time-low points total", () => {
    expect(evaluateClubRecordTrophies(10, [95, 80, 60])).toEqual(["club-worst-ever"]);
  });

  it("awards nothing for a run that merely ties the existing best or worst", () => {
    expect(evaluateClubRecordTrophies(95, [95, 80, 60])).toEqual([]);
    expect(evaluateClubRecordTrophies(60, [95, 80, 60])).toEqual([]);
  });

  it("awards nothing for a middling run between the existing best and worst", () => {
    expect(evaluateClubRecordTrophies(75, [95, 80, 60])).toEqual([]);
  });

  it("with exactly one prior entry, beats it in only one direction at a time — never both", () => {
    expect(evaluateClubRecordTrophies(100, [50])).toEqual(["club-record-breaker"]);
    expect(evaluateClubRecordTrophies(10, [50])).toEqual(["club-worst-ever"]);
  });
});
