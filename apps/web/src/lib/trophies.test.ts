import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, TIER_META, TROPHY_CATALOG } from "./trophies";

describe("TROPHY_CATALOG", () => {
  it("has a complete, non-empty display entry for every trophy key", () => {
    // Record<TrophyKey, …> already forces an entry per key at compile time; this checks the content.
    for (const meta of Object.values(TROPHY_CATALOG)) {
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(meta.colorClass).toMatch(/text-/);
    }
  });

  it("gives every trophy a distinct name", () => {
    const names = Object.values(TROPHY_CATALOG).map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives Invincible and Champions the trophy-gold amber accent, matching Golden Boot elsewhere", () => {
    expect(TROPHY_CATALOG.invincible.colorClass).toContain("amber");
    expect(TROPHY_CATALOG.champions.colorClass).toContain("amber");
  });

  it("ranks tiers common → legendary and labels every category", () => {
    expect(TIER_META.common.order).toBeLessThan(TIER_META.rare.order);
    expect(TIER_META.epic.order).toBeLessThan(TIER_META.legendary.order);
    expect(Object.values(CATEGORY_LABELS).every((l) => l.length > 0)).toBe(true);
  });
});
