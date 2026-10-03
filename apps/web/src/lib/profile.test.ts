import { describe, expect, it } from "vitest";
import type { CabinetEntryDto, ProfileDto } from "../api/types";
import { cabinetShareCard, ordinal, sortCabinet, weekIndex, weeklyTrophy } from "./profile";

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

describe("cabinetShareCard", () => {
  const profile = (cabinet: CabinetEntryDto[]) =>
    ({
      user: { displayName: "Tester", isGuest: false, memberSince: "2026-10-01" },
      stats: { seasonsFinished: 3, titles: 2, winRate: 0.6, bestPoints: { value: 88 }, unbeatenSeasons: 1 },
      cabinet,
    }) as unknown as ProfileDto;

  it("leads with the trophy count and lists the rarest held trophies", () => {
    const cabinet = [
      entry({ key: "champions", count: 2, rarityPct: 40 }),
      entry({ key: "invincible", tier: "legendary", count: 1, rarityPct: 0.5 }),
      entry({ key: "united-nations", tier: "epic", rarityPct: 1 }),
    ];
    const { card, caption } = cabinetShareCard(profile(cabinet));
    expect(card.headline).toBe("2 / 3");
    expect(card.lines[0]).toContain("The Invincible");
    expect(card.lines[1]).toContain("×2");
    expect(card.lines.join(" ")).not.toContain("United Nations");
    expect(card.ribbon).toBe("Legendary");
    expect(caption).toContain("2 of 3 trophies");
    expect(caption).toContain("Rarest: The Invincible");
  });

  it("summarises the overflow beyond five trophies", () => {
    const keys = ["champions", "top-four", "golden-boot", "playmaker", "mvp", "golden-glove", "regular"] as const;
    const { card } = cabinetShareCard(profile(keys.map((key) => entry({ key, count: 1 }))));
    expect(card.lines).toHaveLength(6);
    expect(card.lines[5]).toBe("+ 2 more");
    expect(card.ribbon).toBeUndefined();
  });
});
