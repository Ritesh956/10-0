import { describe, expect, it } from "vitest";
import type { MatchSummaryDto } from "../api/types";
import { awardNamesFor, derbyLine, findRivalry, titleIdiom } from "./leagueFlavour";
import { buildSeasonNarrative } from "./seasonNarrative";

const match = (fixtureId: string, home: string, away: string, hs: number, as: number, matchday = 1): MatchSummaryDto => ({
  fixtureId,
  matchday,
  homeClubId: home,
  awayClubId: away,
  homeScore: hs,
  awayScore: as,
  goals: [],
});

describe("league award names", () => {
  it("gives each league its own names and falls back to the generic ones", () => {
    expect(awardNamesFor("league-es1").goldenBoot).toBe("Pichichi");
    expect(awardNamesFor("league-es1").goldenGlove).toBe("Zamora");
    expect(awardNamesFor("league-it1").goldenBoot).toBe("Capocannoniere");
    expect(awardNamesFor("league-l1").goldenBoot).toBe("Torjägerkanone");
    expect(awardNamesFor(undefined).goldenBoot).toBe("Golden Boot");
    expect(titleIdiom("league-it1")).toBe("the Scudetto");
    expect(titleIdiom(undefined)).toBe("the title");
  });
});

describe("rivalries", () => {
  it("finds a named derby whichever way round the clubs are", () => {
    expect(findRivalry("league-es1", "Real Madrid", "FC Barcelona")).toBe("El Clásico");
    expect(findRivalry("league-es1", "FC Barcelona", "Real Madrid")).toBe("El Clásico");
    expect(findRivalry("league-it1", "Inter Milan", "AC Milan")).toBe("Derby della Madonnina");
    expect(findRivalry("league-gb1", "Arsenal FC", "Tottenham")).toBe("North London derby");
    expect(findRivalry("league-gb1", "Arsenal FC", "Brighton")).toBeUndefined();
    expect(findRivalry("league-fr1", "Real Madrid", "FC Barcelona")).toBeUndefined();
  });

  const names: Record<string, string> = { me: "Liverpool FC", mu: "Manchester United", ev: "Everton", bh: "Brighton" };
  const nameFor = (id: string) => names[id] ?? id;

  it("summarises the user's best derby", () => {
    const line = derbyLine(
      "league-gb1",
      "Liverpool FC",
      "me",
      [match("1", "me", "mu", 3, 1), match("2", "mu", "me", 0, 2), match("3", "me", "ev", 0, 1), match("4", "me", "bh", 5, 0)],
      nameFor,
    );
    expect(line).toBe("North-West derby bragging rights: won both (3-1 and 2-0).");
  });

  it("owns up to a sore one and says nothing without a derby", () => {
    expect(derbyLine("league-gb1", "Liverpool FC", "me", [match("1", "me", "mu", 0, 2), match("2", "mu", "me", 1, 1)], nameFor)).toMatch(
      /ended level|went your way|sore one/,
    );
    expect(derbyLine("league-gb1", "Liverpool FC", "me", [match("1", "me", "mu", 0, 2), match("2", "mu", "me", 3, 0)], nameFor)).toMatch(
      /sore one/,
    );
    expect(derbyLine("league-gb1", "Liverpool FC", "me", [match("1", "me", "bh", 1, 0)], nameFor)).toBeUndefined();
    expect(derbyLine(undefined, "Liverpool FC", "me", [match("1", "me", "mu", 1, 0)], nameFor)).toBeUndefined();
  });

  it("flows into the season narrative, with the league's title idiom", () => {
    const narrative = buildSeasonNarrative({
      position: 1,
      seasonSize: 20,
      points: 90,
      clubName: "Liverpool FC",
      userClubId: "me",
      squadOverall: 88,
      leagueId: "league-it1",
      squad: undefined,
      matches: [match("1", "me", "mu", 2, 0)],
      teamStats: null,
      januaryOutcome: null,
      managerPhilosophy: null,
      nameFor,
    });
    expect(narrative.finishParagraph).toContain("the Scudetto");
    expect(narrative.derbyLine).toBeUndefined(); // no Serie A derby in this fixture list
  });
});
