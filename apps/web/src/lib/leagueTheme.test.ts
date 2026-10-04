import { afterEach, describe, expect, it } from "vitest";
import { applyLeagueTheme, LEAGUE_THEMES, leagueTheme, rememberLeagueTheme, storedLeagueTheme } from "./leagueTheme";
import { playLeagueIdOf } from "./leagues";

afterEach(() => applyLeagueTheme(undefined));

describe("league theme", () => {
  it("has a distinct accent for each of the five leagues", () => {
    expect(LEAGUE_THEMES).toHaveLength(5);
    expect(new Set(LEAGUE_THEMES.map((t) => t.accent[500])).size).toBe(5);
  });

  it("points the accent variables at the league, and back to the default", () => {
    applyLeagueTheme("league-es1");
    const root = document.documentElement;
    expect(root.getAttribute("data-league")).toBe("league-es1");
    expect(root.style.getPropertyValue("--c-mint-400")).toBe(leagueTheme("league-es1")!.accent[400]);
    applyLeagueTheme(undefined);
    expect(root.hasAttribute("data-league")).toBe(false);
    expect(root.style.getPropertyValue("--c-mint-400")).toBe("");
  });

  it("remembers the last chosen league and ignores unknown ids", () => {
    rememberLeagueTheme("league-it1");
    expect(storedLeagueTheme()).toBe("league-it1");
    localStorage.setItem("futbol_league_theme", "nonsense");
    expect(storedLeagueTheme()).toBeUndefined();
  });

  it("plays in the explicit league when the draft spans all five", () => {
    expect(playLeagueIdOf({ leagueIds: ["a", "b", "c"], playLeagueId: "b" })).toBe("b");
    expect(playLeagueIdOf({ leagueIds: ["a"] })).toBe("a");
  });
});
