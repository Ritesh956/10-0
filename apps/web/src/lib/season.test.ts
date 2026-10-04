import { describe, expect, it } from "vitest";
import { formatSeason } from "./season";

describe("formatSeason", () => {
  it("formats a start year as YYYY/YY", () => {
    expect(formatSeason(2013)).toBe("2013/14");
    expect(formatSeason(1999)).toBe("1999/00");
    expect(formatSeason(2009)).toBe("2009/10");
  });

  it("returns an empty string for placeholder years", () => {
    expect(formatSeason(0)).toBe("");
  });
});
