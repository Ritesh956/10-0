import { describe, expect, it } from "vitest";
import { buildCabinet, computeCareerStats, computeStreaks, type ProfileRun } from "./profile.logic.js";

const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12));

let seq = 0;
function run(overrides: Partial<ProfileRun> = {}): ProfileRun {
  seq++;
  return {
    worldId: `w${seq}`,
    createdAt: day(seq),
    clubName: `XI ${seq}`,
    formation: "4-3-3",
    leagueId: "league-gb1",
    mode: "solo",
    finished: true,
    points: 70,
    position: 4,
    leagueSize: 20,
    won: 20,
    drawn: 10,
    lost: 8,
    goalsFor: 60,
    goalsAgainst: 35,
    squadOverall: 82,
    longestWinStreak: 5,
    trophies: [],
    ...overrides,
  };
}

describe("computeCareerStats", () => {
  it("summarises finished runs and ignores unfinished ones", () => {
    const runs = [
      run({ points: 80, trophies: ["champions", "top-four"], position: 1, formation: "4-4-2" }),
      run({ points: 60, position: 9, formation: "4-4-2", squadOverall: 88 }),
      run({ finished: false, points: null, won: null, drawn: null, lost: null, formation: "3-5-2" }),
    ];
    const stats = computeCareerStats(runs, 2);
    expect(stats.seasonsStarted).toBe(3);
    expect(stats.seasonsFinished).toBe(2);
    expect(stats.titles).toBe(1);
    expect(stats.bestPoints).toMatchObject({ worldId: runs[0]!.worldId, value: 80 });
    expect(stats.matchesPlayed).toBe(76);
    expect(stats.winRate).toBeCloseTo(40 / 76);
    expect(stats.averageFinish).toBe(5);
    expect(stats.favouriteFormation).toBe("4-4-2");
    expect(stats.topRatedXi).toMatchObject({ worldId: runs[1]!.worldId, value: 88 });
    expect(stats.trophiesEarned).toBe(2);
  });

  it("copes with runs finalized before the detailed records existed", () => {
    const stats = computeCareerStats(
      [run({ won: null, drawn: null, lost: null, position: null, goalsFor: null, squadOverall: null })],
      0,
    );
    expect(stats.winRate).toBeNull();
    expect(stats.bestRecord).toBeNull();
    expect(stats.bestPoints?.value).toBe(70);
    expect(stats.averageFinish).toBeNull();
    expect(stats.topRatedXi).toBeNull();
  });
});

describe("computeStreaks", () => {
  it("tracks current and best title, unbeaten and rising-points runs", () => {
    const runs = [
      run({ createdAt: day(0), points: 60, trophies: ["champions"] }),
      run({ createdAt: day(1), points: 70, trophies: ["champions", "unbeaten"] }),
      run({ createdAt: day(2), points: 65 }),
      run({ createdAt: day(3), points: 75, trophies: ["champions", "invincible"] }),
    ];
    const s = computeStreaks(runs, day(3));
    expect(s.titles).toEqual({ current: 1, best: 2 });
    expect(s.unbeaten).toEqual({ current: 1, best: 1 });
    expect(s.onTheUp).toEqual({ current: 1, best: 1 });
    expect(s.days).toEqual({ current: 4, best: 4 });
  });

  it("lets the day streak lapse after a missed day but keeps the best", () => {
    const runs = [run({ createdAt: day(0) }), run({ createdAt: day(1) }), run({ createdAt: day(5) })];
    expect(computeStreaks(runs, day(6)).days).toEqual({ current: 1, best: 2 });
    expect(computeStreaks(runs, day(8)).days).toEqual({ current: 0, best: 2 });
  });
});

describe("buildCabinet", () => {
  it("lists every trophy with counts, rarity and progress", () => {
    const runs = [run({ trophies: ["champions"], points: 95 }), run({ trophies: ["champions"] })];
    const earned = [
      { key: "champions", worldId: runs[0]!.worldId, unlockedAt: day(1) },
      { key: "champions", worldId: runs[1]!.worldId, unlockedAt: day(2) },
    ];
    const cabinet = buildCabinet(runs, earned, new Map([["champions", 3]]), 10);
    const champions = cabinet.find((c) => c.key === "champions")!;
    expect(champions).toMatchObject({ count: 2, lastWorldId: runs[1]!.worldId, rarityPct: 30, progress: null });
    expect(cabinet.find((c) => c.key === "serial-winner")!.progress).toEqual({ current: 2, target: 5 });
    expect(cabinet.find((c) => c.key === "centurion")!.progress).toEqual({ current: 95, target: 100 });
    expect(cabinet.find((c) => c.key === "invincible")).toMatchObject({ count: 0, rarityPct: 0, firstEarnedAt: null });
  });

  it("has no rarity before anyone has finished a season", () => {
    expect(buildCabinet([], [], new Map(), 0).every((c) => c.rarityPct === null)).toBe(true);
  });
});
