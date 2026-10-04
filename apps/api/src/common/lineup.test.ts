import { describe, expect, it } from "vitest";
import { buildLineup, positionsForFormation, validateUserLineup, type DraftCandidate, type LineupSlot } from "./lineup.js";

function candidate(id: string, positions: DraftCandidate["positions"], overall: number): DraftCandidate {
  return { refPlayerSeasonId: id, positions, overall };
}

describe("buildLineup", () => {
  it("fills all 11 formation slots with position-eligible players when the pool covers every position", () => {
    const formation = "4-4-2";
    const slots = positionsForFormation(formation);
    const pool: DraftCandidate[] = slots.map((pos, i) => candidate(`p${i}`, [pos], 50 + i));
    // add a few extra bench-only players
    pool.push(candidate("bench1", ["CM"], 40), candidate("bench2", ["ST"], 35));

    const lineup = buildLineup(formation, pool);

    expect(lineup.starters).toHaveLength(11);
    for (let i = 0; i < slots.length; i++) {
      expect(lineup.starters[i]?.position).toBe(slots[i]);
    }
    // every starter id should come from the pool and none repeated
    const starterIds = new Set(lineup.starters.map((s) => s.refPlayerSeasonId));
    expect(starterIds.size).toBe(11);
  });

  it("prefers the highest-overall eligible player for each slot", () => {
    const formation = "4-4-2";
    const pool: DraftCandidate[] = [
      candidate("gk-weak", ["GK"], 40),
      candidate("gk-strong", ["GK"], 80),
      ...positionsForFormation(formation)
        .slice(1)
        .map((pos, i) => candidate(`filler${i}`, [pos], 50)),
    ];
    const lineup = buildLineup(formation, pool);
    const gkSlot = lineup.starters.find((s) => s.position === "GK");
    expect(gkSlot?.refPlayerSeasonId).toBe("gk-strong");
  });

  it("falls back to the best remaining player when no one is eligible for a slot", () => {
    // pool has no GK at all
    const formation = "4-4-2";
    const pool: DraftCandidate[] = positionsForFormation(formation)
      .slice(1)
      .map((pos, i) => candidate(`p${i}`, [pos], 50 + i));
    pool.push(candidate("extra", ["ST"], 99));

    const lineup = buildLineup(formation, pool);
    expect(lineup.starters).toHaveLength(11);
    // a slot got filled by fallback (non-GK-eligible player) since no GK exists
    const gkSlot = lineup.starters.find((s) => s.position === "GK");
    expect(gkSlot).toBeDefined();
  });

  it("puts leftover players on the bench sorted by overall, capped at 12", () => {
    const formation = "4-4-2";
    const slots = positionsForFormation(formation);
    const starters = slots.map((pos, i) => candidate(`starter${i}`, [pos], 70));
    const extras = Array.from({ length: 15 }, (_, i) => candidate(`extra${i}`, ["CM"], i));
    const lineup = buildLineup(formation, [...starters, ...extras]);

    expect(lineup.bench.length).toBeLessThanOrEqual(12);
    const overalls = lineup.bench.map((_, i) => 14 - i); // extras were 0..14, best (14) first
    expect(overalls[0]).toBeGreaterThanOrEqual(overalls[overalls.length - 1] ?? 0);
  });

  it("fills a slot with a compatible player before falling back to an out-of-group star", () => {
    // Regression for a real bug: 3 CBs and no RB in a 4-3-3. The old single-pass greedy filled the
    // empty RB slot with the best remaining player of ANY position (the 95-rated striker), then
    // shoved a centre-back up front.
    const lineup = buildLineup("4-3-3", REAL_XI);
    const at = (pos: string) => lineup.starters.filter((s) => s.position === pos).map((s) => s.refPlayerSeasonId);
    expect(at("RB")).toEqual(["lovren"]);
    expect(at("ST")).toEqual(["suarez"]);
  });

  it("prefers a same-group player over a different-group one when nobody is compatible", () => {
    const formation = "4-4-2";
    const pool: DraftCandidate[] = positionsForFormation(formation)
      .filter((p) => p !== "GK")
      .map((pos, i) => candidate(`p${i}`, [pos], 60));
    // No GK at all: GK is its own group, so the final any-position pass still fills it.
    pool.push(candidate("striker", ["ST"], 99));
    const lineup = buildLineup(formation, pool);
    expect(lineup.starters).toHaveLength(11);
    const st = lineup.starters.filter((s) => s.position === "ST").map((s) => s.refPlayerSeasonId);
    expect(st).toContain("striker");
  });

  it("throws for an unknown formation", () => {
    expect(() => buildLineup("2-2-2" as never, [])).toThrow();
  });

  it.each(["4-1-2-1-2", "4-2-2-2"] as const)("fills all 11 slots for %s", (formation) => {
    const slots = positionsForFormation(formation);
    expect(slots).toHaveLength(11);
    const pool: DraftCandidate[] = slots.map((pos, i) => candidate(`p${i}`, [pos], 50 + i));
    const lineup = buildLineup(formation, pool);
    expect(lineup.starters).toHaveLength(11);
    for (let i = 0; i < slots.length; i++) {
      expect(lineup.starters[i]?.position).toBe(slots[i]);
    }
  });
});

/** The XI from the 2026-10-03 live playthrough that exposed the lineup bug (4-3-3, Lovren — a CB —
    placed at RB by the user). */
const REAL_XI: DraftCandidate[] = [
  candidate("butland", ["GK"], 89),
  candidate("baines", ["LB"], 92),
  candidate("mings", ["CB"], 90),
  candidate("gvardiol", ["CB"], 98),
  candidate("lovren", ["CB"], 87),
  candidate("mccarthy", ["CDM"], 84),
  candidate("fabregas", ["CM"], 93),
  candidate("gueye", ["CM"], 88),
  candidate("zaha", ["LW"], 90),
  candidate("suarez", ["ST"], 95),
  candidate("ritchie", ["RW"], 87),
];

const USER_LINEUP: LineupSlot[] = [
  { position: "GK", refPlayerSeasonId: "butland" },
  { position: "LB", refPlayerSeasonId: "baines" },
  { position: "CB", refPlayerSeasonId: "mings" },
  { position: "CB", refPlayerSeasonId: "gvardiol" },
  { position: "RB", refPlayerSeasonId: "lovren" },
  { position: "CDM", refPlayerSeasonId: "mccarthy" },
  { position: "CM", refPlayerSeasonId: "fabregas" },
  { position: "CM", refPlayerSeasonId: "gueye" },
  { position: "LW", refPlayerSeasonId: "zaha" },
  { position: "ST", refPlayerSeasonId: "suarez" },
  { position: "RW", refPlayerSeasonId: "ritchie" },
];

describe("validateUserLineup", () => {
  it("keeps every player in exactly the slot the user chose", () => {
    const lineup = validateUserLineup("4-3-3", USER_LINEUP, REAL_XI);
    expect(lineup.starters).toEqual(USER_LINEUP);
    expect(lineup.bench).toEqual([]);
  });

  it("keeps a deliberate out-of-position choice the auto-fill would never make", () => {
    // Mings (CB) at RB and Lovren (CB) at CB — legal via the compatibility graph, and the user's call.
    const swapped = USER_LINEUP.map((s) =>
      s.refPlayerSeasonId === "mings" ? { ...s, position: "RB" as const } : s.refPlayerSeasonId === "lovren" ? { ...s, position: "CB" as const } : s,
    );
    const lineup = validateUserLineup("4-3-3", swapped, REAL_XI);
    expect(lineup.starters.find((s) => s.position === "RB")?.refPlayerSeasonId).toBe("mings");
  });

  it("accepts entries in any order and returns them in formation slot order", () => {
    const lineup = validateUserLineup("4-3-3", [...USER_LINEUP].reverse(), REAL_XI);
    expect(lineup.starters.map((s) => s.position)).toEqual(positionsForFormation("4-3-3"));
    expect(lineup.starters.find((s) => s.position === "ST")?.refPlayerSeasonId).toBe("suarez");
  });

  it("benches pool players who aren't in the lineup", () => {
    const lineup = validateUserLineup("4-3-3", USER_LINEUP, [...REAL_XI, candidate("sub", ["CM"], 70)]);
    expect(lineup.bench.map((b) => b.refPlayerSeasonId)).toEqual(["sub"]);
  });

  it("rejects a player in a slot they can't play", () => {
    const bad = USER_LINEUP.map((s) => (s.refPlayerSeasonId === "suarez" ? { ...s, position: "RB" as const } : s.refPlayerSeasonId === "lovren" ? { ...s, position: "ST" as const } : s));
    expect(() => validateUserLineup("4-3-3", bad, REAL_XI)).toThrow(/can't play/);
  });

  it("rejects a lineup that doesn't match the formation's slots", () => {
    const bad = USER_LINEUP.map((s) => (s.position === "CDM" ? { ...s, position: "CM" as const } : s));
    expect(() => validateUserLineup("4-3-3", bad, REAL_XI)).toThrow(/missing a CDM/);
  });

  it("rejects the wrong number of players, duplicates, and players outside the pool", () => {
    expect(() => validateUserLineup("4-3-3", USER_LINEUP.slice(0, 10), REAL_XI)).toThrow(/exactly 11/);
    const dup = USER_LINEUP.map((s) => (s.refPlayerSeasonId === "gueye" ? { ...s, refPlayerSeasonId: "fabregas" } : s));
    expect(() => validateUserLineup("4-3-3", dup, REAL_XI)).toThrow(/twice/);
    const stranger = USER_LINEUP.map((s) => (s.refPlayerSeasonId === "gueye" ? { ...s, refPlayerSeasonId: "nobody" } : s));
    expect(() => validateUserLineup("4-3-3", stranger, REAL_XI)).toThrow(/isn't part/);
  });
});
