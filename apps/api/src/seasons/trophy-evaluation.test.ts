import { describe, expect, it } from "vitest";
import {
  careerProgress,
  evaluateCareerTrophies,
  evaluateTrophies,
  type CareerRun,
  type RunSquadPlayer,
  type RunSummary,
} from "./trophy-evaluation.js";

function run(overrides: Partial<RunSummary> = {}): RunSummary {
  return { userClubId: "us", played: 38, won: 20, drawn: 10, lost: 8, position: 5, ...overrides };
}

describe("evaluateTrophies", () => {
  it("awards Invincible for a perfect record (won every match), not Unbeaten too", () => {
    const trophies = evaluateTrophies(run({ played: 38, won: 38, drawn: 0, lost: 0 }));
    expect(trophies).toContain("invincible");
    expect(trophies).not.toContain("unbeaten");
  });

  it("awards Unbeaten for no losses but at least one draw", () => {
    const trophies = evaluateTrophies(run({ played: 38, won: 30, drawn: 8, lost: 0 }));
    expect(trophies).toContain("unbeaten");
    expect(trophies).not.toContain("invincible");
  });

  it("awards neither Invincible nor Unbeaten once there's a single loss", () => {
    const trophies = evaluateTrophies(run({ played: 38, won: 30, drawn: 7, lost: 1 }));
    expect(trophies).not.toContain("invincible");
    expect(trophies).not.toContain("unbeaten");
  });

  it("never awards an unbeaten-family trophy for a played=0 run", () => {
    expect(evaluateTrophies(run({ played: 0, won: 0, drawn: 0, lost: 0 }))).toEqual([]);
  });

  it("awards Champions only for position 1", () => {
    expect(evaluateTrophies(run({ position: 1 }))).toContain("champions");
    expect(evaluateTrophies(run({ position: 2 }))).not.toContain("champions");
  });

  it("awards Golden Boot/Playmaker/Golden Glove/MVP only when the user's club holds them", () => {
    const trophies = evaluateTrophies(
      run({
        userClubId: "us",
        goldenBootClubId: "us",
        playmakerClubId: "them",
        goldenGloveClubId: "us",
        mvpClubId: "us",
      }),
    );
    expect(trophies).toContain("golden-boot");
    expect(trophies).not.toContain("playmaker");
    expect(trophies).toContain("golden-glove");
    expect(trophies).toContain("mvp");
  });

  it("returns an empty list when nothing was won and no award was held", () => {
    expect(evaluateTrophies(run({ position: 10 }))).toEqual([]);
  });

  it("awards Golden Generation (nations-champion) only for position 1 with a nations-locked run", () => {
    expect(evaluateTrophies(run({ position: 1, nationsLocked: true }))).toContain("nations-champion");
    expect(evaluateTrophies(run({ position: 2, nationsLocked: true }))).not.toContain("nations-champion");
    // Winning the league with a normal (non-nations-locked) squad never earns it, even though the
    // position condition is otherwise identical to "champions".
    expect(evaluateTrophies(run({ position: 1, nationsLocked: false }))).not.toContain("nations-champion");
    expect(evaluateTrophies(run({ position: 1 }))).not.toContain("nations-champion");
  });

  it("awards Kings of Europe for winning the European Final, and The Double only alongside the title", () => {
    // Regression: winning the European competition used to award nothing at all.
    const europeOnly = evaluateTrophies(run({ position: 3, europeChampion: true }));
    expect(europeOnly).toContain("european-champion");
    expect(europeOnly).not.toContain("the-double");

    const double = evaluateTrophies(run({ position: 1, europeChampion: true }));
    expect(double).toEqual(expect.arrayContaining(["champions", "european-champion", "the-double"]));

    expect(evaluateTrophies(run({ position: 1 }))).not.toContain("the-double");
  });

  it("can award multiple trophies at once for a dominant title-winning campaign", () => {
    const trophies = evaluateTrophies(
      run({
        userClubId: "us",
        played: 38,
        won: 38,
        drawn: 0,
        lost: 0,
        position: 1,
        goldenBootClubId: "us",
        mvpClubId: "us",
      }),
    );
    expect(trophies).toEqual(expect.arrayContaining(["invincible", "champions", "top-four", "golden-boot", "mvp"]));
    expect(trophies).toHaveLength(5);
  });

  it("scales the points/goals trophies per game, so a 34-game league can earn them", () => {
    expect(evaluateTrophies(run({ played: 38, points: 100 }))).toContain("centurion");
    expect(evaluateTrophies(run({ played: 38, points: 99 }))).not.toContain("centurion");
    expect(evaluateTrophies(run({ played: 34, points: 90 }))).toContain("centurion");
    expect(evaluateTrophies(run({ played: 38, goalsFor: 95 }))).toContain("goal-machine");
    expect(evaluateTrophies(run({ played: 38, goalsAgainst: 22 }))).toContain("fortress");
    expect(evaluateTrophies(run({ played: 38, goalsAgainst: 23 }))).not.toContain("fortress");
  });

  it("compares the finish with the draft room's projection", () => {
    expect(evaluateTrophies(run({ position: 3, projectedFinish: 8 }))).toContain("overachievers");
    expect(evaluateTrophies(run({ position: 4, projectedFinish: 8 }))).not.toContain("overachievers");
    expect(evaluateTrophies(run({ position: 1, projectedFinish: 8 }))).toContain("miracle");
    expect(evaluateTrophies(run({ position: 1, projectedFinish: 7 }))).not.toContain("miracle");
    expect(evaluateTrophies(run({ position: 6, projectedFinish: 1 }))).toContain("bottle-job");
    expect(evaluateTrophies(run({ position: 4, projectedFinish: 1 }))).not.toContain("bottle-job");
    expect(evaluateTrophies(run({ position: 1 }))).not.toContain("miracle");
  });

  it("knows the bottom of a 20- and an 18-club table", () => {
    expect(evaluateTrophies(run({ position: 17, leagueSize: 20 }))).toContain("great-escape");
    expect(evaluateTrophies(run({ position: 18, leagueSize: 20 }))).toContain("relegated");
    expect(evaluateTrophies(run({ position: 18, leagueSize: 20 }))).not.toContain("great-escape");
    expect(evaluateTrophies(run({ position: 16, leagueSize: 18 }))).toContain("relegated");
    expect(evaluateTrophies(run({ position: 15, leagueSize: 18 }))).toContain("great-escape");
  });
});

function player(i: number, overrides: Partial<RunSquadPlayer> = {}): RunSquadPlayer {
  return {
    name: `Player ${String.fromCharCode(65 + i)}son`,
    nationality: "England",
    age: 27,
    seasonYear: 2015,
    refClubId: `club-${i}`,
    ...overrides,
  };
}
const xi = (fn: (i: number) => Partial<RunSquadPlayer> = () => ({})) =>
  Array.from({ length: 11 }, (_, i) => player(i, fn(i)));

describe("evaluateTrophies — squad composition", () => {
  const champs = (squad: RunSquadPlayer[], extra: Partial<RunSummary> = {}) =>
    evaluateTrophies(run({ position: 1, leagueCountry: "England", squad, ...extra }));

  it("United Nations needs eleven nationalities and the title", () => {
    const squad = xi((i) => ({ nationality: `Nation ${i}` }));
    expect(champs(squad)).toContain("united-nations");
    expect(evaluateTrophies(run({ position: 2, squad }))).not.toContain("united-nations");
    expect(champs(xi((i) => ({ nationality: `Nation ${Math.min(i, 9)}` })))).not.toContain("united-nations");
  });

  it("Homegrown / Foreign Legion read the league's own nationality, but not for a nations-locked XI", () => {
    expect(champs(xi())).toContain("homegrown");
    expect(champs(xi(), { nationsLocked: true })).not.toContain("homegrown");
    expect(champs(xi(() => ({ nationality: "Brazil" })))).toContain("foreign-legion");
    expect(champs(xi((i) => ({ nationality: i === 0 ? "England" : "Brazil" })))).not.toContain("foreign-legion");
  });

  it("season spread: one season is Class Of, eight or more is Time Travellers", () => {
    expect(champs(xi())).toContain("class-of");
    expect(champs(xi((i) => ({ seasonYear: 2012 + i })))).toContain("time-travellers");
    expect(champs(xi((i) => ({ seasonYear: 2012 + (i % 7) })))).not.toContain("time-travellers");
  });

  it("Band of Brothers needs five from one real club, outside One-Club mode", () => {
    const squad = xi((i) => ({ refClubId: i < 5 ? "arsenal" : `club-${i}` }));
    expect(champs(squad)).toContain("band-of-brothers");
    expect(champs(squad, { oneClubLocked: true })).not.toContain("band-of-brothers");
    expect(champs(xi((i) => ({ refClubId: i < 4 ? "arsenal" : `club-${i}` })))).not.toContain("band-of-brothers");
  });

  it("average age: 30+ is Dad's Army, 24 or under is Fledglings", () => {
    expect(champs(xi(() => ({ age: 31 })))).toContain("dads-army");
    expect(champs(xi(() => ({ age: 23 })))).toContain("fledglings");
    expect(champs(xi())).not.toContain("dads-army");
    expect(champs(xi())).not.toContain("fledglings");
  });

  it("Alphabet Soup needs six surnames sharing an initial, accents ignored, any finish", () => {
    const names = ["Mesut Özil", "Jan Oblak", "Nicolás Otamendi", "Divock Origi", "Dani Olmo", "Michael Olise"];
    const squad = xi((i) => ({ name: names[i] ?? `Player ${i}` }));
    expect(evaluateTrophies(run({ position: 12, squad }))).toContain("alphabet-soup");
    expect(evaluateTrophies(run({ position: 12, squad: xi() }))).not.toContain("alphabet-soup");
  });

  it("skips composition trophies without a full XI", () => {
    expect(champs(xi().slice(0, 10))).not.toContain("class-of");
  });
});

describe("career trophies", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
  const runs = (flags: { champion?: boolean; leagueId?: string; formation?: string }[]): CareerRun[] =>
    flags.map((f, i) => ({
      createdAt: day(i),
      leagueId: f.leagueId ?? "league-gb1",
      formation: f.formation ?? "4-3-3",
      champion: f.champion ?? false,
    }));

  it("counts seasons, titles and the best consecutive title run", () => {
    const p = careerProgress(
      runs([{ champion: true }, { champion: true }, {}, { champion: true }, { champion: true }, { champion: true }]),
    );
    expect(p.regular).toBe(6);
    expect(p["serial-winner"]).toBe(5);
    expect(p.dynasty).toBe(3);
    expect(evaluateCareerTrophies(runs([{}, {}, {}, {}, {}]))).toEqual(["regular"]);
  });

  it("orders by date, not input order, for the title run", () => {
    const shuffled = runs([{ champion: true }, {}, { champion: true }, { champion: true }]).reverse();
    expect(careerProgress(shuffled).dynasty).toBe(2);
  });

  it("five-league champion and globetrotter count distinct leagues", () => {
    const leagues = ["league-gb1", "league-es1", "league-it1", "league-l1", "league-fr1"];
    const all = runs(leagues.map((leagueId) => ({ leagueId, champion: leagueId !== "league-fr1" })));
    const p = careerProgress(all);
    expect(p.globetrotter).toBe(5);
    expect(p["five-league-champion"]).toBe(4);
    expect(evaluateCareerTrophies(all)).toContain("globetrotter");
    expect(evaluateCareerTrophies(all)).not.toContain("five-league-champion");
  });

  it("tactician counts formations among title wins only", () => {
    const p = careerProgress(
      runs([
        { champion: true, formation: "4-3-3" },
        { champion: true, formation: "4-4-2" },
        { champion: false, formation: "3-5-2" },
      ]),
    );
    expect(p.tactician).toBe(2);
  });
});

describe("cross-league European trophies", () => {
  const phase = (over: Partial<{ played: number; won: number; drawn: number; lost: number; rank: number | null }> = {}) => ({
    played: 8,
    won: 5,
    drawn: 1,
    lost: 2,
    rank: 10,
    ...over,
  });
  const europe = (leaguePhase = phase(), countriesBeaten: string[] = []) => ({ leaguePhase, countriesBeaten });

  it("awards the league-phase trophies off the eight-game record", () => {
    const t = evaluateTrophies(run({ europe: europe(phase({ won: 6, drawn: 2, lost: 0, rank: 2 })) }));
    expect(t).toContain("european-unbeaten");
    expect(t).not.toContain("perfect-eight");
    expect(t).not.toContain("top-of-europe");

    const perfect = evaluateTrophies(run({ europe: europe(phase({ won: 8, drawn: 0, lost: 0, rank: 1 })) }));
    expect(perfect).toEqual(expect.arrayContaining(["european-unbeaten", "perfect-eight", "top-of-europe"]));
  });

  it("needs all eight games played", () => {
    expect(evaluateTrophies(run({ europe: europe(phase({ played: 4, won: 4, drawn: 0, lost: 0, rank: 1 })) }))).not.toContain(
      "perfect-eight",
    );
  });

  it("Grand Tour needs a win against clubs from all four other leagues", () => {
    const four = ["Spain", "Italy", "Germany", "France"];
    expect(evaluateTrophies(run({ leagueCountry: "England", europe: europe(phase(), four) }))).toContain("grand-tour");
    expect(evaluateTrophies(run({ leagueCountry: "England", europe: europe(phase(), four.slice(0, 3)) }))).not.toContain("grand-tour");
    // Beating clubs from your own league doesn't count towards the four.
    expect(
      evaluateTrophies(run({ leagueCountry: "England", europe: europe(phase(), [...four.slice(0, 3), "England"]) })),
    ).not.toContain("grand-tour");
  });

  it("the Continental Cup has its own trophy", () => {
    expect(evaluateTrophies(run({ cupChampion: true }))).toContain("continental-cup");
  });

  const xi = (countries: string[]): RunSquadPlayer[] =>
    Array.from({ length: 11 }, (_, i) => ({
      name: `Player ${i}`,
      nationality: "Brazil",
      age: 27,
      seasonYear: 2020,
      refClubId: `c${i}`,
      clubCountry: countries[i % countries.length]!,
    }));

  it("Continental Raiders: win Europe with an XI from a single other league", () => {
    expect(evaluateTrophies(run({ europeChampion: true, leagueCountry: "England", squad: xi(["Spain"]) }))).toContain(
      "continental-raiders",
    );
    expect(evaluateTrophies(run({ europeChampion: true, leagueCountry: "England", squad: xi(["England"]) }))).not.toContain(
      "continental-raiders",
    );
    expect(evaluateTrophies(run({ europeChampion: false, leagueCountry: "England", squad: xi(["Spain"]) }))).not.toContain(
      "continental-raiders",
    );
  });

  it("Five-League XI: starters from clubs in all five leagues, title not required", () => {
    const five = ["England", "Spain", "Italy", "Germany", "France"];
    expect(evaluateTrophies(run({ position: 9, squad: xi(five) }))).toContain("five-league-xi");
    expect(evaluateTrophies(run({ position: 9, squad: xi(five.slice(0, 4)) }))).not.toContain("five-league-xi");
  });
});
