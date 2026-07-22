import { describe, expect, it } from "vitest";
import { shouldSimulateMatchday } from "./process-season.js";

describe("shouldSimulateMatchday", () => {
  it("simulates every matchday when no cutoff is given", () => {
    expect(shouldSimulateMatchday(1, undefined)).toBe(true);
    expect(shouldSimulateMatchday(38, undefined)).toBe(true);
  });

  it("simulates matchdays up to and including the cutoff", () => {
    expect(shouldSimulateMatchday(1, 19)).toBe(true);
    expect(shouldSimulateMatchday(19, 19)).toBe(true);
  });

  it("stops simulating matchdays past the cutoff", () => {
    expect(shouldSimulateMatchday(20, 19)).toBe(false);
    expect(shouldSimulateMatchday(38, 19)).toBe(false);
  });
});
