import { describe, expect, it } from "vitest";
import {
  EVENT_WEIGHTS,
  biasPoolForEvent,
  findWeakestSlot,
  pickEventType,
  totalEventWeight,
  type LineupSlotJson,
} from "./january.logic.js";

describe("pickEventType", () => {
  it("maps a roll to POSITIVE/NEUTRAL/NEGATIVE at the exact weighted boundaries", () => {
    const positiveWeight = EVENT_WEIGHTS.find((w) => w.type === "POSITIVE")!.weight;
    const neutralWeight = EVENT_WEIGHTS.find((w) => w.type === "NEUTRAL")!.weight;

    expect(pickEventType(0)).toBe("POSITIVE");
    expect(pickEventType(positiveWeight - 1)).toBe("POSITIVE");
    expect(pickEventType(positiveWeight)).toBe("NEUTRAL");
    expect(pickEventType(positiveWeight + neutralWeight - 1)).toBe("NEUTRAL");
    expect(pickEventType(positiveWeight + neutralWeight)).toBe("NEGATIVE");
    expect(pickEventType(totalEventWeight() - 1)).toBe("NEGATIVE");
  });

  it("covers every roll in [0, totalEventWeight()) with no gaps", () => {
    for (let roll = 0; roll < totalEventWeight(); roll++) {
      expect(["POSITIVE", "NEUTRAL", "NEGATIVE"]).toContain(pickEventType(roll));
    }
  });
});

describe("findWeakestSlot", () => {
  it("returns the occupied slot with the lowest overall", () => {
    const lineup: LineupSlotJson[] = [
      { position: "GK", playerId: "gk" },
      { position: "CB", playerId: "cb" },
      { position: "ST", playerId: "st" },
    ];
    const playerById = new Map([
      ["gk", { overall: 70 }],
      ["cb", { overall: 55 }],
      ["st", { overall: 80 }],
    ]);
    const result = findWeakestSlot(lineup, playerById);
    expect(result?.slot.playerId).toBe("cb");
    expect(result?.player.overall).toBe(55);
  });

  it("skips slots whose player id has no match, and ties resolve to the first occurrence", () => {
    const lineup: LineupSlotJson[] = [
      { position: "CB", playerId: "missing" },
      { position: "LB", playerId: "a" },
      { position: "RB", playerId: "b" },
    ];
    const playerById = new Map([
      ["a", { overall: 60 }],
      ["b", { overall: 60 }],
    ]);
    const result = findWeakestSlot(lineup, playerById);
    expect(result?.slot.playerId).toBe("a");
  });

  it("returns undefined when no slot resolves to a known player", () => {
    const lineup: LineupSlotJson[] = [{ position: "GK", playerId: "ghost" }];
    expect(findWeakestSlot(lineup, new Map())).toBeUndefined();
  });
});

describe("biasPoolForEvent", () => {
  const pool = [{ overall: 40 }, { overall: 60 }, { overall: 80 }];

  it("POSITIVE narrows to strictly-higher overalls", () => {
    const biased = biasPoolForEvent(pool, "POSITIVE", 60);
    expect(biased.map((p) => p.overall)).toEqual([80]);
  });

  it("NEGATIVE narrows to strictly-lower overalls", () => {
    const biased = biasPoolForEvent(pool, "NEGATIVE", 60);
    expect(biased.map((p) => p.overall)).toEqual([40]);
  });

  it("NEUTRAL never narrows", () => {
    expect(biasPoolForEvent(pool, "NEUTRAL", 60)).toEqual(pool);
  });

  it("falls back to the full pool when the biased slice would be empty", () => {
    // Nobody in the pool beats a 999-overall outgoing player — POSITIVE would otherwise strand
    // the draw with zero candidates.
    expect(biasPoolForEvent(pool, "POSITIVE", 999)).toEqual(pool);
    expect(biasPoolForEvent(pool, "NEGATIVE", -1)).toEqual(pool);
  });
});
