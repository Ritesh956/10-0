import { describe, expect, it } from "vitest";
import { leaguePhaseVerdict, leaguePhaseZone } from "./europe";

describe("league-phase zones", () => {
  it("splits a 36-club table 8 / 16 / 12", () => {
    expect([1, 8].map(leaguePhaseZone)).toEqual(["R16", "R16"]);
    expect([9, 24].map(leaguePhaseZone)).toEqual(["PO", "PO"]);
    expect([25, 36].map(leaguePhaseZone)).toEqual(["OUT", "OUT"]);
  });

  it("words the verdict with the right ordinal", () => {
    expect(leaguePhaseVerdict(1)).toMatch(/1st .*Round of 16/);
    expect(leaguePhaseVerdict(22)).toMatch(/22nd .*play-off/);
    expect(leaguePhaseVerdict(31)).toMatch(/31st .*eliminated/);
  });
});
