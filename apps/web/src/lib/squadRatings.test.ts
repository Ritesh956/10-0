import { describe, expect, it } from "vitest";
import { squadTierName, TIER_BORDER, TIER_TEXT } from "./squadRatings";

describe("squadTierName", () => {
  it("maps the exact band boundaries correctly", () => {
    expect(squadTierName(88)).toBe("Galácticos");
    expect(squadTierName(87)).toBe("Elite");
    expect(squadTierName(82)).toBe("Elite");
    expect(squadTierName(81)).toBe("Strong");
    expect(squadTierName(76)).toBe("Strong");
    expect(squadTierName(75)).toBe("Mid-table");
    expect(squadTierName(68)).toBe("Mid-table");
    expect(squadTierName(67)).toBe("Budget");
    expect(squadTierName(60)).toBe("Budget");
    expect(squadTierName(59)).toBe("Minnows");
    expect(squadTierName(0)).toBe("Minnows");
  });

  it("is monotonically non-decreasing in tier rank as overall rises", () => {
    const order: Record<string, number> = { Minnows: 0, Budget: 1, "Mid-table": 2, Strong: 3, Elite: 4, Galácticos: 5 };
    let prevRank = -1;
    for (let overall = 0; overall <= 99; overall++) {
      const rank = order[squadTierName(overall)]!;
      expect(rank).toBeGreaterThanOrEqual(prevRank);
      prevRank = rank;
    }
  });

  it("has a color token for every tier", () => {
    for (const tier of Object.keys(TIER_TEXT) as (keyof typeof TIER_TEXT)[]) {
      expect(TIER_TEXT[tier]).toMatch(/^text-/);
      expect(TIER_BORDER[tier]).toMatch(/^border-/);
    }
  });
});
