import { describe, expect, it } from "vitest";
import { EVENT_TEMPLATES, eventKey, isoWeekKey, templateFor, weekEndsAt } from "./events.logic.js";

describe("isoWeekKey", () => {
  it("numbers ISO weeks (Monday start, Thursday decides the year)", () => {
    expect(isoWeekKey(new Date("2026-10-04T12:00:00Z"))).toBe("2026-W40"); // a Sunday
    expect(isoWeekKey(new Date("2026-10-05T00:00:00Z"))).toBe("2026-W41"); // Monday
    expect(isoWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01"); // belongs to next ISO year
    expect(isoWeekKey(new Date("2021-01-03T00:00:00Z"))).toBe("2020-W53");
  });

  it("is the same for every day of one week", () => {
    const keys = ["05", "06", "07", "08", "09", "10", "11"].map((d) => isoWeekKey(new Date(`2026-10-${d}T23:59:00Z`)));
    expect(new Set(keys).size).toBe(1);
  });
});

describe("weekEndsAt", () => {
  it("is the next Monday at midnight UTC", () => {
    expect(weekEndsAt(new Date("2026-10-04T12:00:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(weekEndsAt(new Date("2026-10-05T00:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(weekEndsAt(new Date("2026-10-08T09:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
});

describe("event templates", () => {
  it("has one per league, each with a name and twist", () => {
    expect(EVENT_TEMPLATES).toHaveLength(5);
    expect(new Set(EVENT_TEMPLATES.map((t) => t.leagueId)).size).toBe(5);
    for (const t of EVENT_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(5);
      expect(t.twist.length).toBeGreaterThan(10);
    }
    expect(templateFor("league-it1")?.name).toBe("Serie A Sunday Survival");
    expect(templateFor("nope")).toBeUndefined();
  });

  it("keys an event by week and league", () => {
    expect(eventKey("2026-W41", "league-es1")).toBe("2026-W41:league-es1");
  });
});
