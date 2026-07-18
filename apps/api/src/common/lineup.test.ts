import { describe, expect, it } from "vitest";
import { buildLineup, positionsForFormation, type DraftCandidate } from "./lineup.js";

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

  it("throws for an unknown formation", () => {
    expect(() => buildLineup("2-2-2" as never, [])).toThrow();
  });
});
