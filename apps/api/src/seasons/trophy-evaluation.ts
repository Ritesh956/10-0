import { TROPHY_DEFS, type TrophyKey } from "@futbol/domain";
import type { EuropeRunSummary } from "../europe/europe.logic.js";

/** One starter in the user's XI, reduced to what the composition trophies look at. */
export interface RunSquadPlayer {
  name: string;
  nationality: string;
  age: number;
  /** Season (start year) of the drafted RefPlayerSeason. */
  seasonYear: number;
  /** The real club the player was drafted from. */
  refClubId: string;
  /** Country of the league that club played in ("England"…), for the cross-league XI trophies. */
  clubCountry?: string | undefined;
}

/** Pure input bundle for trophy evaluation — everything SeasonsService.finalizeRun already has
    on hand from getStandings/getCompetitionStats, reshaped into one flat record so the actual
    condition-checking is unit-testable without touching Prisma. */
export interface RunSummary {
  userClubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** 1-indexed final league position. */
  position: number;
  goldenBootClubId?: string | undefined;
  playmakerClubId?: string | undefined;
  goldenGloveClubId?: string | undefined;
  mvpClubId?: string | undefined;
  /** Phase 10 (Nations Trophy): true when this run's squad was drafted nationality-locked
      (World.settings.nationsNationality set) — gates "nations-champion" alongside the existing
      position===1 check so a normal fantasy-XI title doesn't also earn it. */
  nationsLocked?: boolean | undefined;
  /** One-Club XI run — "band-of-brothers" would be automatic, so it's excluded. */
  oneClubLocked?: boolean | undefined;
  /** True when this world's European competition has been played and the user's club won the Final. */
  europeChampion?: boolean | undefined;
  /** The user's XI won the Nations Cup tournament. */
  nationsCupChampion?: boolean | undefined;
  /** The user's club won the Continental Cup (the second European tier). */
  cupChampion?: boolean | undefined;
  /** The user's European Nights campaign, when they played it. */
  europe?: EuropeRunSummary | undefined;
  goalsFor?: number | undefined;
  goalsAgainst?: number | undefined;
  points?: number | undefined;
  /** Clubs in the league (20 or 18) — "great-escape"/"relegated" key off the bottom three. */
  leagueSize?: number | undefined;
  /** The finish the draft room projected (World.settings.projection.finish). */
  projectedFinish?: number | undefined;
  /** The league's country, e.g. "England" — RefPlayer.nationality uses the same strings. */
  leagueCountry?: string | undefined;
  /** The starting XI as it finished the season. */
  squad?: RunSquadPlayer[] | undefined;
}

/** 100 points over 38 games, as a per-game pace so 34-game leagues can earn it too. */
export const CENTURION_PPG = 100 / 38;
export const GOAL_MACHINE_GPG = 2.5;
export const FORTRESS_GAPG = 0.6;

/** Evaluates the trophy catalog (packages/domain's TrophyKey) against one finished run. "The
    Invincible" (won every match, the true 38-0-0 record) and "Unbeaten" (no losses, but at least
    one draw) are mutually exclusive — a perfect record earns the rarer trophy, not both. */
export function evaluateTrophies(run: RunSummary): TrophyKey[] {
  const trophies: TrophyKey[] = [];
  const champion = run.position === 1;

  if (run.played > 0 && run.lost === 0) {
    if (run.won === run.played) trophies.push("invincible");
    else trophies.push("unbeaten");
  }
  if (champion) trophies.push("champions");
  if (run.position <= 4) trophies.push("top-four");
  if (champion && run.nationsLocked) trophies.push("nations-champion");
  if (run.europeChampion) trophies.push("european-champion");
  if (run.europeChampion && champion) trophies.push("the-double");
  if (run.cupChampion) trophies.push("continental-cup");
  if (run.nationsCupChampion) trophies.push("nations-cup-winner");
  trophies.push(...evaluateEuropeTrophies(run));
  if (run.goldenBootClubId === run.userClubId) trophies.push("golden-boot");
  if (run.playmakerClubId === run.userClubId) trophies.push("playmaker");
  if (run.goldenGloveClubId === run.userClubId) trophies.push("golden-glove");
  if (run.mvpClubId === run.userClubId) trophies.push("mvp");

  if (run.played > 0) {
    if (run.points !== undefined && run.points / run.played >= CENTURION_PPG) trophies.push("centurion");
    if (run.goalsFor !== undefined && run.goalsFor / run.played >= GOAL_MACHINE_GPG) trophies.push("goal-machine");
    if (run.goalsAgainst !== undefined && run.goalsAgainst / run.played <= FORTRESS_GAPG) trophies.push("fortress");
  }

  if (run.projectedFinish !== undefined) {
    if (run.projectedFinish - run.position >= 5) trophies.push("overachievers");
    if (champion && run.projectedFinish >= 8) trophies.push("miracle");
    if (run.projectedFinish === 1 && run.position > 4) trophies.push("bottle-job");
  }

  if (run.leagueSize !== undefined && run.leagueSize >= 10) {
    if (run.position === run.leagueSize - 3) trophies.push("great-escape");
    if (run.position > run.leagueSize - 3) trophies.push("relegated");
  }

  trophies.push(...evaluateSquadTrophies(run, champion));
  return trophies;
}

/** Trophies for the European Nights campaign itself: the league phase and who you beat. */
function evaluateEuropeTrophies(run: RunSummary): TrophyKey[] {
  const europe = run.europe;
  const trophies: TrophyKey[] = [];
  const phase = europe?.leaguePhase;
  if (phase && phase.played >= 8) {
    if (phase.lost === 0) trophies.push("european-unbeaten");
    if (phase.won === phase.played) trophies.push("perfect-eight");
    if (phase.rank === 1) trophies.push("top-of-europe");
  }
  const abroad = new Set((europe?.countriesBeaten ?? []).filter((c) => c !== run.leagueCountry));
  if (abroad.size >= 4) trophies.push("grand-tour");

  // Winning Europe with an XI drawn entirely from one league that isn't the one you play in.
  const squad = run.squad;
  if (run.europeChampion && squad && squad.length >= 11 && run.leagueCountry) {
    const countries = new Set(squad.map((p) => p.clubCountry));
    const [only] = [...countries];
    if (countries.size === 1 && only && only !== run.leagueCountry) trophies.push("continental-raiders");
  }
  return trophies;
}

function evaluateSquadTrophies(run: RunSummary, champion: boolean): TrophyKey[] {
  const squad = run.squad;
  if (!squad || squad.length < 11) return [];
  const trophies: TrophyKey[] = [];

  if (champion) {
    const nationalities = new Set(squad.map((p) => p.nationality));
    if (nationalities.size >= 11) trophies.push("united-nations");
    if (run.leagueCountry && !run.nationsLocked) {
      const locals = squad.filter((p) => p.nationality === run.leagueCountry).length;
      if (locals === squad.length) trophies.push("homegrown");
      if (locals === 0) trophies.push("foreign-legion");
    }

    const seasons = new Set(squad.map((p) => p.seasonYear));
    if (seasons.size === 1) trophies.push("class-of");
    if (seasons.size >= 8) trophies.push("time-travellers");

    if (!run.oneClubLocked && maxCount(squad.map((p) => p.refClubId)) >= 5) trophies.push("band-of-brothers");

    const avgAge = squad.reduce((sum, p) => sum + p.age, 0) / squad.length;
    if (avgAge >= 30) trophies.push("dads-army");
    if (avgAge <= 24) trophies.push("fledglings");
  }

  const clubCountries = new Set(squad.map((p) => p.clubCountry).filter((c): c is string => Boolean(c)));
  if (clubCountries.size >= 5) trophies.push("five-league-xi");

  if (maxCount(squad.map((p) => surnameInitial(p.name)).filter((c) => c !== "")) >= 6) {
    trophies.push("alphabet-soup");
  }
  return trophies;
}

function maxCount(values: string[]): number {
  const counts = new Map<string, number>();
  let max = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > max) max = n;
  }
  return max;
}

/** "Ö" in "Mesut Özil" → "O"; a one-word name ("Neymar") is its own surname. */
export function surnameInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const surname = parts[parts.length - 1] ?? "";
  return surname.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
}

/** One finished run, as far as the career trophies care. */
export interface CareerRun {
  createdAt: Date;
  leagueId: string | null;
  formation: string | null;
  champion: boolean;
}

export type CareerTrophyKey =
  | "regular"
  | "veteran"
  | "serial-winner"
  | "dynasty"
  | "tactician"
  | "globetrotter"
  | "five-league-champion";

export const CAREER_TROPHIES: CareerTrophyKey[] = [
  "regular",
  "veteran",
  "serial-winner",
  "dynasty",
  "tactician",
  "globetrotter",
  "five-league-champion",
];

/** Where each career trophy's progress bar stands — the best value reached so far, so a broken
    title streak still shows the longest one. */
export function careerProgress(runs: CareerRun[]): Record<CareerTrophyKey, number> {
  const ordered = [...runs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const titles = ordered.filter((r) => r.champion);

  let bestTitleRun = 0;
  let current = 0;
  for (const r of ordered) {
    current = r.champion ? current + 1 : 0;
    bestTitleRun = Math.max(bestTitleRun, current);
  }

  const distinct = (values: (string | null)[]) => new Set(values.filter((v): v is string => v !== null)).size;

  return {
    regular: ordered.length,
    veteran: ordered.length,
    "serial-winner": titles.length,
    dynasty: bestTitleRun,
    tactician: distinct(titles.map((r) => r.formation)),
    globetrotter: distinct(ordered.map((r) => r.leagueId)),
    "five-league-champion": distinct(titles.map((r) => r.leagueId)),
  };
}

/** Career trophies whose target the runs have reached. */
export function evaluateCareerTrophies(runs: CareerRun[]): CareerTrophyKey[] {
  const progress = careerProgress(runs);
  return CAREER_TROPHIES.filter((key) => progress[key] >= (TROPHY_DEFS[key].target ?? Infinity));
}
