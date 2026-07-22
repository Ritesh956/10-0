import { describe, expect, it } from "vitest";
import { checkFormationFillable } from "./oneClubValidation";

const FULL_COVERAGE = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

describe("checkFormationFillable", () => {
  it("is fillable when every slot has at least one directly-matching position", () => {
    const result = checkFormationFillable("4-3-3", FULL_COVERAGE);
    expect(result).toEqual({ fillable: true, missingPositions: [] });
  });

  it("is fillable via the versatility graph even without an exact-position match", () => {
    // 3-5-2 needs LWB/RWB — a club whose history only ever recorded LB/RB (no wing-backs) is still
    // fillable, since canPlayPosition's compatibility graph covers LB->LWB and RB->RWB.
    const result = checkFormationFillable("3-5-2", ["GK", "CB", "LB", "RB", "CM", "ST"]);
    expect(result.fillable).toBe(true);
  });

  it("flags missing positions when the club's history has genuinely never covered a slot", () => {
    // No goalkeeper ever recorded — no compatibility substitute exists for GK.
    const result = checkFormationFillable("4-4-2", ["CB", "LB", "RB", "LM", "CM", "RM", "ST"]);
    expect(result.fillable).toBe(false);
    expect(result.missingPositions).toEqual(["GK"]);
  });

  it("deduplicates repeated missing slots (e.g. two ST slots in 4-4-2)", () => {
    const result = checkFormationFillable("4-4-2", ["GK", "CB", "LB", "RB", "LM", "CM", "RM"]);
    expect(result.fillable).toBe(false);
    expect(result.missingPositions).toEqual(["ST"]);
  });

  it("an empty coverage set is unfillable for any formation with at least one slot", () => {
    const result = checkFormationFillable("4-3-3", []);
    expect(result.fillable).toBe(false);
    expect(result.missingPositions.length).toBeGreaterThan(0);
  });
});
