import { describe, expect, it } from "vitest";
import type { JanuaryResultDto, MatchSummaryDto, SquadPositionOverallDto, TeamStatsDto } from "../api/types";
import {
  biggestWinText,
  buildSeasonNarrative,
  compositionSentence,
  computeFinishBracket,
  computeVerdict,
  groupSquadUnits,
  januaryLines,
  managerClosingLine,
  standoutQuote,
  unitTierLabel,
} from "./seasonNarrative";

describe("computeVerdict", () => {
  it("labels a finish well ahead of projection OVERACHIEVED, in mint", () => {
    // overall 75 -> projectedFinish ~10-11 (mid-table); finishing #2 is way better than projected.
    const verdict = computeVerdict(2, 20, 75);
    expect(verdict.label).toBe("OVERACHIEVED");
    expect(verdict.colorClass).toContain("mint");
  });

  it("labels a finish well behind projection FLATTERED TO DECEIVE, in crimson", () => {
    // overall 92 -> projectedFinish ~1-2 (title-winning pace); finishing #14 is way worse than projected.
    const verdict = computeVerdict(14, 20, 92);
    expect(verdict.label).toBe("FLATTERED TO DECEIVE");
    expect(verdict.colorClass).toContain("crimson");
  });

  it("labels a finish close to projection AS EXPECTED", () => {
    const verdict = computeVerdict(10, 20, 75); // projectedFinish is ~10-11 for overall 75
    expect(verdict.label).toBe("AS EXPECTED");
  });

  it("falls back to a position-only heuristic when squadOverall is unavailable", () => {
    expect(computeVerdict(2, 20, undefined).label).toBe("STRONG SEASON");
    expect(computeVerdict(19, 20, undefined).label).toBe("TOUGH SEASON");
    expect(computeVerdict(10, 20, undefined).label).toBe("AS EXPECTED");
  });
});

describe("unitTierLabel", () => {
  it("maps the exact band boundaries", () => {
    expect(unitTierLabel(85)).toBe("Elite");
    expect(unitTierLabel(84)).toBe("Excellent");
    expect(unitTierLabel(78)).toBe("Excellent");
    expect(unitTierLabel(77)).toBe("Strong");
    expect(unitTierLabel(70)).toBe("Strong");
    expect(unitTierLabel(69)).toBe("Very good");
    expect(unitTierLabel(62)).toBe("Very good");
    expect(unitTierLabel(61)).toBe("Solid");
    expect(unitTierLabel(52)).toBe("Solid");
    expect(unitTierLabel(51)).toBe("Shaky");
    expect(unitTierLabel(0)).toBe("Shaky");
  });
});

describe("groupSquadUnits", () => {
  it("averages overall per position group using lib/formations' POSITION_GROUP", () => {
    const squad: SquadPositionOverallDto[] = [
      { position: "GK", overall: 80 },
      { position: "CB", overall: 70 },
      { position: "CB", overall: 74 },
      { position: "CM", overall: 76 },
      { position: "ST", overall: 84 },
    ];
    const units = groupSquadUnits(squad);
    expect(units.goalkeeping).toBe(80);
    expect(units.defence).toBe(72); // avg(70, 74)
    expect(units.midfield).toBe(76);
    expect(units.attack).toBe(84);
  });

  it("returns 0 for a unit with nobody in it", () => {
    const units = groupSquadUnits([{ position: "GK", overall: 80 }]);
    expect(units.attack).toBe(0);
  });
});

describe("compositionSentence", () => {
  it("names the strongest and weakest unit when they differ", () => {
    const text = compositionSentence({ attack: 90, midfield: 70, defence: 60, goalkeeping: 65 });
    expect(text).toContain("attack");
    expect(text).toContain("defence");
  });

  it("describes a balanced squad when every unit is equal", () => {
    const text = compositionSentence({ attack: 75, midfield: 75, defence: 75, goalkeeping: 75 });
    expect(text).toContain("balanced");
  });
});

describe("computeFinishBracket", () => {
  it("classifies every bracket boundary for a 20-club league", () => {
    expect(computeFinishBracket(1, 20)).toBe("champion");
    expect(computeFinishBracket(4, 20)).toBe("top4");
    expect(computeFinishBracket(5, 20)).toBe("europa");
    expect(computeFinishBracket(6, 20)).toBe("europa");
    expect(computeFinishBracket(7, 20)).toBe("mid-table");
    expect(computeFinishBracket(14, 20)).toBe("mid-table");
    expect(computeFinishBracket(15, 20)).toBe("relegation-scrap");
    expect(computeFinishBracket(17, 20)).toBe("relegation-scrap");
    expect(computeFinishBracket(18, 20)).toBe("relegated");
    expect(computeFinishBracket(20, 20)).toBe("relegated");
  });

  it("scales the relegation zone proportionally for an 18-club league instead of a fixed count", () => {
    // relegationZoneSize = max(3, round(18*0.15)) = 3 -> relegated: >15, relegation-scrap: >12 and <=15
    expect(computeFinishBracket(12, 18)).toBe("mid-table");
    expect(computeFinishBracket(13, 18)).toBe("relegation-scrap");
    expect(computeFinishBracket(16, 18)).toBe("relegated");
  });
});

function match(fixtureId: string, homeScore: number, awayScore: number): MatchSummaryDto {
  return { fixtureId, matchday: 1, homeClubId: "us", awayClubId: "them", homeScore, awayScore, goals: [] };
}

describe("biggestWinText", () => {
  it("picks the win with the largest margin, not the highest score", () => {
    const text = biggestWinText(
      [match("f1", 5, 3), match("f2", 3, 0), match("f3", 1, 0)],
      "us",
      () => "Rivals FC",
    );
    expect(text).toBe("a 3-0 win over Rivals FC");
  });

  it("returns undefined when there is no win to report", () => {
    expect(biggestWinText([match("f1", 0, 1), match("f2", 1, 1)], "us", () => "Rivals FC")).toBeUndefined();
  });
});

describe("januaryLines", () => {
  const outcome: JanuaryResultDto = {
    eventType: "POSITIVE",
    outPlayer: { id: "out1", name: "Old Winger", overall: 60, position: "RW" },
    inPlayer: { id: "in1", name: "New Winger", overall: 75, position: "RW", clubName: "Some Club", seasonYear: 2019 },
    delta: 15,
  };

  it("produces an arrival line and a departure line when a January transfer happened", () => {
    const lines = januaryLines(outcome);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("New Winger");
    expect(lines[1]).toContain("Old Winger");
    expect(lines[1]).toContain("+15");
  });

  it("returns an empty array when there was no January transfer", () => {
    expect(januaryLines(null)).toEqual([]);
    expect(januaryLines(undefined)).toEqual([]);
  });
});

describe("standoutQuote", () => {
  it("picks the topScorer when their combined contribution is higher", () => {
    const teamStats: TeamStatsDto = {
      clubId: "us",
      goalsFor: 10,
      goalsAgainst: 5,
      topScorer: { playerId: "p1", name: "Sam Striker", matchesPlayed: 30, goals: 20, assists: 2 },
      topAssist: { playerId: "p2", name: "Alex Assist", matchesPlayed: 30, goals: 1, assists: 5 },
      squad: [],
    };
    const quote = standoutQuote(teamStats);
    expect(quote?.line).toContain("Sam Striker");
    expect(quote?.aside).toContain("Striker");
  });

  it("returns undefined when there is no scorer or assister at all", () => {
    expect(standoutQuote({ clubId: "us", goalsFor: 0, goalsAgainst: 0, squad: [] })).toBeUndefined();
    expect(standoutQuote(null)).toBeUndefined();
  });
});

describe("managerClosingLine", () => {
  it("echoes the manager's philosophy blurb", () => {
    const line = managerClosingLine("Fluid possession, intense counter-press", "Our XI");
    expect(line).toContain("Fluid possession, intense counter-press");
    expect(line).toContain("Our XI");
  });

  it("returns undefined for a manager-less club", () => {
    expect(managerClosingLine(null, "Our XI")).toBeUndefined();
    expect(managerClosingLine(undefined, "Our XI")).toBeUndefined();
  });
});

describe("buildSeasonNarrative", () => {
  it("assembles every signal into one bundle given a full input", () => {
    const outcome: JanuaryResultDto = {
      eventType: "NEGATIVE",
      outPlayer: { id: "out1", name: "Old CB", overall: 70, position: "CB" },
      inPlayer: { id: "in1", name: "New CB", overall: 62, position: "CB", clubName: "Some Club", seasonYear: 2015 },
      delta: -8,
    };
    const teamStats: TeamStatsDto = {
      clubId: "us",
      goalsFor: 50,
      goalsAgainst: 30,
      topScorer: { playerId: "p1", name: "Sam Striker", matchesPlayed: 30, goals: 20, assists: 2 },
      squad: [],
    };
    const squad: SquadPositionOverallDto[] = [
      { position: "GK", overall: 80 },
      { position: "CB", overall: 70 },
      { position: "ST", overall: 84 },
    ];

    const narrative = buildSeasonNarrative({
      position: 3,
      seasonSize: 20,
      points: 78,
      clubName: "Our XI",
      userClubId: "us",
      squadOverall: 76,
      squad,
      matches: [match("f1", 4, 0)],
      teamStats,
      januaryOutcome: outcome,
      managerPhilosophy: "Fluid possession, intense counter-press",
      nameFor: (id) => (id === "them" ? "Rivals FC" : id),
    });

    expect(narrative.verdict.label).toBeTruthy();
    expect(narrative.unitTiers).toBeTruthy();
    expect(narrative.compositionSentence).toBeTruthy();
    expect(narrative.finishParagraph).toContain("#3");
    expect(narrative.finishParagraph).toContain("78 points");
    expect(narrative.finishParagraph).toContain("Rivals FC");
    expect(narrative.januaryLines).toHaveLength(2);
    expect(narrative.standout?.line).toContain("Sam Striker");
    expect(narrative.managerLine).toContain("Our XI");
  });

  it("degrades gracefully with no squad, no January, no manager, and no standout", () => {
    const narrative = buildSeasonNarrative({
      position: 10,
      seasonSize: 20,
      points: 45,
      clubName: "Our XI",
      userClubId: "us",
      squadOverall: undefined,
      squad: undefined,
      matches: [],
      teamStats: null,
      januaryOutcome: null,
      managerPhilosophy: null,
      nameFor: (id) => id,
    });

    expect(narrative.unitTiers).toBeUndefined();
    expect(narrative.compositionSentence).toBeUndefined();
    expect(narrative.januaryLines).toEqual([]);
    expect(narrative.standout).toBeUndefined();
    expect(narrative.managerLine).toBeUndefined();
    expect(narrative.finishParagraph).toContain("#10");
  });
});
