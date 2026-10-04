import { describe, expect, it } from "vitest";
import { computeManagerStats, type ClubMatchResult } from "./season-stats.logic.js";

describe("computeManagerStats", () => {
  function result(opponentClubId: string, ourScore: number, theirScore: number): ClubMatchResult {
    return { opponentClubId, ourScore, theirScore };
  }

  it("counts a clean sheet whenever the opponent scores 0", () => {
    const stats = computeManagerStats([result("a", 2, 0), result("b", 1, 1), result("c", 0, 0)]);
    expect(stats.cleanSheets).toBe(2);
  });

  it("tracks the LONGEST consecutive win streak, not just total wins", () => {
    // W W L W W W D W => longest run is 3 (the W-W-W block), not 4 total wins-in-a-row anywhere else
    const results = [
      result("a", 1, 0),
      result("b", 1, 0),
      result("c", 0, 1),
      result("d", 1, 0),
      result("e", 1, 0),
      result("f", 1, 0),
      result("g", 1, 1),
      result("h", 1, 0),
    ];
    expect(computeManagerStats(results).longestWinStreak).toBe(3);
  });

  it("a draw or loss resets the current streak", () => {
    const stats = computeManagerStats([result("a", 1, 0), result("b", 1, 1), result("c", 1, 0)]);
    expect(stats.longestWinStreak).toBe(1);
  });

  it("picks the win with the largest margin as biggestWin, not the highest score", () => {
    // 5-3 (margin 2) vs 2-0 (margin 2, tie broken by first-seen) vs 3-0 (margin 3, the real winner)
    const stats = computeManagerStats([result("a", 5, 3), result("b", 2, 0), result("c", 3, 0)]);
    expect(stats.biggestWin).toEqual({ opponentClubId: "c", ourScore: 3, theirScore: 0, margin: 3 });
  });

  it("picks the highest combined-goals match regardless of win/loss/draw", () => {
    const stats = computeManagerStats([result("a", 1, 0), result("b", 2, 3), result("c", 0, 1)]);
    expect(stats.highestScoringMatch).toEqual({ opponentClubId: "b", ourScore: 2, theirScore: 3, total: 5 });
  });

  it("returns undefined biggestWin/highestScoringMatch for an empty result list", () => {
    const stats = computeManagerStats([]);
    expect(stats.cleanSheets).toBe(0);
    expect(stats.longestWinStreak).toBe(0);
    expect(stats.biggestWin).toBeUndefined();
    expect(stats.highestScoringMatch).toBeUndefined();
  });
});
