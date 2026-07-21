import { describe, expect, it } from "vitest";
import { canPlayPosition } from "./formations";

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
