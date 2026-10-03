import { describe, expect, it } from "vitest";
import {
  EVENT_WEIGHTS,
  biasPoolForEvent,
  findWeakestSlot,
  JANUARY_KINDS,
  biasPoolForKind,
  drawDistinct,
  eventTypeForDelta,
  pickKind,
  pickTargetSlot,
  seededRandom,
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

describe("January event kinds", () => {
  const lineup: LineupSlotJson[] = [
    { position: "GK", playerId: "a" },
    { position: "CB", playerId: "b" },
    { position: "ST", playerId: "c" },
  ];
  const byId = new Map([
    ["a", { overall: 70 }],
    ["b", { overall: 64 }],
    ["c", { overall: 88 }],
  ]);

  it("the offer is a pure function of its seed, so it can't be re-rolled by asking again", () => {
    const a = seededRandom("season-1:club-1");
    const b = seededRandom("season-1:club-1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(pickKind(seededRandom("x")).kind).toBe(pickKind(seededRandom("x")).kind);
  });

  it("every kind is reachable and weights cover the whole roll", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(pickKind(seededRandom(`s${i}`)).kind);
    expect(seen.size).toBe(JANUARY_KINDS.length);
  });

  it("targets the weakest, strongest or a random slot as the event says", () => {
    const r = seededRandom("t");
    expect(pickTargetSlot(lineup, byId, "weakest", r)?.slot.playerId).toBe("b");
    expect(pickTargetSlot(lineup, byId, "strongest", r)?.slot.playerId).toBe("c");
    expect(["a", "b", "c"]).toContain(pickTargetSlot(lineup, byId, "random", r)?.slot.playerId);
  });

  it("a star sale is a downgrade, but within 8 points when possible", () => {
    const spec = JANUARY_KINDS.find((k) => k.kind === "star-wants-out")!;
    const pool = [{ overall: 60 }, { overall: 82 }, { overall: 85 }, { overall: 90 }];
    expect(biasPoolForKind(pool, spec, 88).map((p) => p.overall)).toEqual([82, 85]);
  });

  it("draws distinct options and labels the outcome by the actual delta", () => {
    const picks = drawDistinct([1, 2, 3, 4, 5], 3, seededRandom("d"));
    expect(new Set(picks).size).toBe(3);
    expect(eventTypeForDelta(3)).toBe("POSITIVE");
    expect(eventTypeForDelta(1)).toBe("NEUTRAL");
    expect(eventTypeForDelta(-2)).toBe("NEGATIVE");
  });
});
