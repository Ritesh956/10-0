import { describe, expect, it } from "vitest";
import { buildInviteCode, rankStandings, type MemberResult } from "./leagues.logic.js";

describe("buildInviteCode", () => {
  it("is deterministic for the same bytes and always the expected length", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(buildInviteCode(bytes)).toBe(buildInviteCode(bytes));
    expect(buildInviteCode(bytes)).toHaveLength(8);
  });

  it("never includes visually-ambiguous characters (0, O, 1, I, L)", () => {
    const allBytesOnce = new Uint8Array(Array.from({ length: 256 }, (_, i) => i));
    const code = buildInviteCode(allBytesOnce);
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      expect(code).not.toContain(ambiguous);
    }
  });

  it("produces different codes for different byte inputs", () => {
    const a = buildInviteCode(new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]));
    const b = buildInviteCode(new Uint8Array([11, 21, 31, 41, 51, 61, 71, 81]));
    expect(a).not.toBe(b);
  });
});

interface FakeEntry {
  points: number;
  goalDiff: number;
}

function member(userId: string, worldId: string | null, entry: FakeEntry | null): MemberResult<FakeEntry> {
  return { userId, worldId, entry };
}

describe("rankStandings", () => {
  it("ranks members with a result by points desc, goal difference as the tiebreak", () => {
    const rows = rankStandings([
      member("a", "w1", { points: 60, goalDiff: 10 }),
      member("b", "w2", { points: 72, goalDiff: -5 }),
      member("c", "w3", { points: 72, goalDiff: 20 }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["c", "b", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.status === "complete")).toBe(true);
  });

  it("never assigns a rank to members without a submitted result", () => {
    const rows = rankStandings([
      member("a", "w1", { points: 50, goalDiff: 0 }),
      member("b", "w2", null),
      member("c", null, null),
    ]);
    const a = rows.find((r) => r.userId === "a")!;
    const b = rows.find((r) => r.userId === "b")!;
    const c = rows.find((r) => r.userId === "c")!;
    expect(a.rank).toBe(1);
    expect(b.rank).toBeNull();
    expect(c.rank).toBeNull();
  });

  it("distinguishes in-progress (drafted, no result yet) from not-started (never drafted)", () => {
    const rows = rankStandings([member("b", "w2", null), member("c", null, null)]);
    expect(rows.find((r) => r.userId === "b")?.status).toBe("in-progress");
    expect(rows.find((r) => r.userId === "c")?.status).toBe("not-started");
  });

  it("handles an all-not-started league (nobody has drafted yet) without throwing", () => {
    const rows = rankStandings([member("a", null, null), member("b", null, null)]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.rank === null && r.status === "not-started")).toBe(true);
  });
});
