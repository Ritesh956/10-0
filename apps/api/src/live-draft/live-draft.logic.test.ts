import { describe, expect, it } from "vitest";
import {
  isRoomComplete,
  LIVE_DRAFT_SLOT_COUNT,
  pickAutoSelection,
  seatForPick,
  totalPicksForRoom,
  type AutoPickCandidate,
} from "./live-draft.logic.js";

describe("seatForPick", () => {
  it("goes 0..N-1 on the first (even) round", () => {
    expect([0, 1, 2, 3].map((i) => seatForPick(i, 4))).toEqual([0, 1, 2, 3]);
  });

  it("reverses N-1..0 on the second (odd) round — the snake", () => {
    expect([4, 5, 6, 7].map((i) => seatForPick(i, 4))).toEqual([3, 2, 1, 0]);
  });

  it("alternates direction round to round across many rounds", () => {
    const seats = Array.from({ length: 12 }, (_, i) => seatForPick(i, 3));
    expect(seats).toEqual([0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0]);
  });

  it("degenerates correctly for a 2-participant room — the round-boundary seat picks twice in a row, by design", () => {
    // [P1, P2, P2, P1] — the classic 2-player snake: whoever picks last in round 0 picks first
    // (again) in round 1, which is what keeps a snake draft fair overall despite the double-up.
    expect([0, 1, 2, 3].map((i) => seatForPick(i, 2))).toEqual([0, 1, 1, 0]);
  });
});

describe("totalPicksForRoom / isRoomComplete", () => {
  it("is participantCount * 11 slots", () => {
    expect(totalPicksForRoom(4)).toBe(4 * LIVE_DRAFT_SLOT_COUNT);
    expect(totalPicksForRoom(2)).toBe(2 * LIVE_DRAFT_SLOT_COUNT);
  });

  it("is not complete one pick short of the total, and is complete exactly at it", () => {
    const total = totalPicksForRoom(3);
    expect(isRoomComplete(total - 1, 3)).toBe(false);
    expect(isRoomComplete(total, 3)).toBe(true);
    expect(isRoomComplete(total + 1, 3)).toBe(true);
  });
});

describe("pickAutoSelection", () => {
  const pool: AutoPickCandidate[] = [
    { id: "ps-1", playerId: "p-1", overall: 70 },
    { id: "ps-2", playerId: "p-2", overall: 95 },
    { id: "ps-3", playerId: "p-3", overall: 88 },
  ];

  it("picks the highest-overall undrafted candidate", () => {
    expect(pickAutoSelection(pool, new Set())?.playerId).toBe("p-2");
  });

  it("skips players already drafted by anyone in the room", () => {
    expect(pickAutoSelection(pool, new Set(["p-2"]))?.playerId).toBe("p-3");
  });

  it("returns undefined when the whole pool is already drafted", () => {
    expect(pickAutoSelection(pool, new Set(["p-1", "p-2", "p-3"]))).toBeUndefined();
  });
});
