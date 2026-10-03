import { describe, expect, it } from "vitest";
import type { CabinetEntryDto } from "../api/types";
import { ordinal, sortCabinet, weekIndex, weeklyTrophy } from "./profile";

function entry(overrides: Partial<CabinetEntryDto>): CabinetEntryDto {
  return {
    key: "champions",
    category: "season",
    tier: "common",
    count: 0,
    firstEarnedAt: null,
    lastWorldId: null,
    progress: null,
    rarityPct: 50,
    ...overrides,
  };
}

describe("sortCabinet", () => {
  const cabinet = [
    entry({ key: "champions", rarityPct: 60, count: 1 }),
    entry({ key: "invincible", tier: "legendary", rarityPct: 1 }),
    entry({ key: "unbeaten", tier: "epic", rarityPct: 1 }),
    entry({ key: "top-four", rarityPct: 80, count: 2 }),
  ];

  it("keeps catalogue order by default", () => {
    expect(sortCabinet(cabinet, "catalogue").map((e) => e.key)).toEqual(["champions", "invincible", "unbeaten", "top-four"]);
  });

  it("puts the rarest first, breaking ties by tier", () => {
    expect(sortCabinet(cabinet, "rarest").map((e) => e.key)).toEqual(["invincible", "unbeaten", "champions", "top-four"]);
  });

  it("puts earned trophies first, otherwise in catalogue order", () => {
    expect(sortCabinet(cabinet, "earned").map((e) => e.key)).toEqual(["champions", "top-four", "invincible", "unbeaten"]);
  });
});

describe("weeklyTrophy", () => {
  it("is stable within a Monday-to-Sunday week and changes the next week", () => {
    const monday = new Date(Date.UTC(2026, 9, 5));
    const sunday = new Date(Date.UTC(2026, 9, 11, 23));
    const nextMonday = new Date(Date.UTC(2026, 9, 12));
    expect(weekIndex(monday)).toBe(weekIndex(sunday));
    expect(weekIndex(nextMonday)).toBe(weekIndex(monday) + 1);
  });

  it("only picks locked single-run trophies", () => {
    const cabinet = [
      entry({ key: "champions", count: 1 }),
      entry({ key: "serial-winner", category: "career" }),
      entry({ key: "nations-champion", category: "modes" }),
      entry({ key: "united-nations", category: "squad" }),
    ];
    expect(weeklyTrophy(cabinet, new Date())?.key).toBe("united-nations");
    expect(weeklyTrophy(cabinet.slice(0, 3), new Date())).toBeNull();
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
  ])("%i → %s", (n, s) => {
    expect(ordinal(n)).toBe(s);
  });
});
