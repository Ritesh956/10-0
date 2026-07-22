import { describe, expect, it } from "vitest";
import { canPlayPosition, FORMATIONS, FORMATION_POSITIONS, slotsForFormation } from "./formations";

describe("canPlayPosition — defensive versatility", () => {
  it("a CB can also cover LB and RB", () => {
    expect(canPlayPosition(["CB"], "CB")).toBe(true);
    expect(canPlayPosition(["CB"], "LB")).toBe(true);
    expect(canPlayPosition(["CB"], "RB")).toBe(true);
  });

  it("an LB can also cover CB (and still LWB, as before)", () => {
    expect(canPlayPosition(["LB"], "LB")).toBe(true);
    expect(canPlayPosition(["LB"], "CB")).toBe(true);
    expect(canPlayPosition(["LB"], "LWB")).toBe(true);
    expect(canPlayPosition(["LB"], "RB")).toBe(false);
  });

  it("an RB can also cover CB (and still RWB, as before)", () => {
    expect(canPlayPosition(["RB"], "RB")).toBe(true);
    expect(canPlayPosition(["RB"], "CB")).toBe(true);
    expect(canPlayPosition(["RB"], "RWB")).toBe(true);
    expect(canPlayPosition(["RB"], "LB")).toBe(false);
  });

  it("a CB is still not eligible for midfield/attack positions", () => {
    expect(canPlayPosition(["CB"], "CM")).toBe(false);
    expect(canPlayPosition(["CB"], "ST")).toBe(false);
  });
});

describe("formation coverage", () => {
  it("every formation has exactly 11 positions", () => {
    for (const formation of FORMATIONS) {
      expect(FORMATION_POSITIONS[formation]).toHaveLength(11);
    }
  });

  it("every formation has exactly one GK", () => {
    for (const formation of FORMATIONS) {
      const gkCount = FORMATION_POSITIONS[formation].filter((p) => p === "GK").length;
      expect(gkCount).toBe(1);
    }
  });

  it.each(["4-1-2-1-2", "4-2-2-2"] as const)("%s produces 11 pitch-coordinate slots matching its position list", (formation) => {
    const slots = slotsForFormation(formation);
    expect(slots).toHaveLength(11);
    expect(slots.map((s) => s.position)).toEqual(FORMATION_POSITIONS[formation]);
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x).toBeLessThanOrEqual(100);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(100);
    }
  });
});
