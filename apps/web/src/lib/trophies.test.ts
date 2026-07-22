import { describe, expect, it } from "vitest";
import type { TrophyKey } from "../api/types";
import { TROPHY_CATALOG } from "./trophies";

const ALL_KEYS: TrophyKey[] = ["invincible", "unbeaten", "champions", "golden-boot", "playmaker", "golden-glove", "mvp"];

describe("TROPHY_CATALOG", () => {
  it("has a complete, non-empty display entry for every trophy key", () => {
    for (const key of ALL_KEYS) {
      const meta = TROPHY_CATALOG[key];
      expect(meta).toBeDefined();
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(meta.colorClass).toMatch(/text-/);
    }
  });

  it("gives Invincible and Champions the trophy-gold amber accent, matching Golden Boot elsewhere", () => {
    expect(TROPHY_CATALOG.invincible.colorClass).toContain("amber");
    expect(TROPHY_CATALOG.champions.colorClass).toContain("amber");
  });
});
