/**
 * League-flavoured copy: each league's own names for the awards, its title idiom, and the derbies
 * the season story calls out. Display-only (the backend's award keys are unchanged) and keyed by the
 * same RefLeague ids as lib/leagueTheme.ts.
 */
import type { MatchSummaryDto } from "../api/types";
import { summarizeForClub } from "./matchResult";

export interface AwardNames {
  goldenBoot: string;
  playmaker: string;
  goldenGlove: string;
  mvp: string;
}

const DEFAULT_AWARDS: AwardNames = { goldenBoot: "Golden Boot", playmaker: "Playmaker", goldenGlove: "Golden Glove", mvp: "MVP" };

const AWARD_NAMES: Record<string, AwardNames> = {
  "league-gb1": { goldenBoot: "Golden Boot", playmaker: "Playmaker", goldenGlove: "Golden Glove", mvp: "Player of the Season" },
  "league-es1": { goldenBoot: "Pichichi", playmaker: "Máximo Asistente", goldenGlove: "Zamora", mvp: "Jugador del Año" },
  "league-it1": { goldenBoot: "Capocannoniere", playmaker: "Re degli Assist", goldenGlove: "Guanto d'Oro", mvp: "MVP" },
  "league-l1": { goldenBoot: "Torjägerkanone", playmaker: "Vorlagenkönig", goldenGlove: "Goldener Handschuh", mvp: "Spieler der Saison" },
  "league-fr1": { goldenBoot: "Meilleur buteur", playmaker: "Meilleur passeur", goldenGlove: "Gant d'Or", mvp: "Joueur de l'année" },
};

/** The award names for a league (the generic English ones for an unknown league / Europe). */
export function awardNamesFor(leagueId: string | undefined): AwardNames {
  return (leagueId && AWARD_NAMES[leagueId]) || DEFAULT_AWARDS;
}

/** What winning the title is called locally, for "lifting …" in the finish paragraph. */
const TITLE_IDIOM: Record<string, string> = {
  "league-gb1": "the Premier League title",
  "league-es1": "the LaLiga crown",
  "league-it1": "the Scudetto",
  "league-l1": "the Meisterschale",
  "league-fr1": "the Ligue 1 title",
};

export function titleIdiom(leagueId: string | undefined): string {
  return (leagueId && TITLE_IDIOM[leagueId]) || "the title";
}

interface Rivalry {
  name: string;
  /** Lower-case name fragments; a club belongs to a side if its name contains any of them. */
  a: string[];
  b: string[];
}

const RIVALRIES: Record<string, Rivalry[]> = {
  "league-gb1": [
    { name: "North-West derby", a: ["liverpool"], b: ["manchester united", "man united"] },
    { name: "Manchester derby", a: ["manchester city", "man city"], b: ["manchester united", "man united"] },
    { name: "North London derby", a: ["arsenal"], b: ["tottenham", "spurs"] },
    { name: "London derby", a: ["chelsea"], b: ["arsenal", "tottenham", "west ham", "fulham", "crystal palace"] },
    { name: "Merseyside derby", a: ["liverpool"], b: ["everton"] },
    { name: "Tyne–Wear derby", a: ["newcastle"], b: ["sunderland"] },
  ],
  "league-es1": [
    { name: "El Clásico", a: ["real madrid"], b: ["barcelona"] },
    { name: "Madrid derby", a: ["real madrid"], b: ["atlético", "atletico"] },
    { name: "Seville derby", a: ["sevilla"], b: ["betis"] },
    { name: "Basque derby", a: ["athletic"], b: ["real sociedad"] },
    { name: "Catalan derby", a: ["barcelona"], b: ["espanyol", "girona"] },
  ],
  "league-it1": [
    { name: "Derby della Madonnina", a: ["inter"], b: ["milan"] },
    { name: "Derby d'Italia", a: ["inter"], b: ["juventus"] },
    { name: "Derby della Capitale", a: ["roma"], b: ["lazio"] },
    { name: "Derby della Mole", a: ["juventus"], b: ["torino"] },
    { name: "Derby del Sole", a: ["napoli"], b: ["roma"] },
  ],
  "league-l1": [
    { name: "Der Klassiker", a: ["bayern"], b: ["dortmund"] },
    { name: "Revierderby", a: ["dortmund"], b: ["schalke"] },
    { name: "Nordderby", a: ["werder", "bremen"], b: ["hamburg"] },
    { name: "Rhine derby", a: ["köln", "cologne"], b: ["leverkusen", "gladbach"] },
  ],
  "league-fr1": [
    { name: "Le Classique", a: ["paris sg", "paris saint"], b: ["marseille"] },
    { name: "Choc des Olympiques", a: ["lyon"], b: ["marseille"] },
    { name: "Derby du Rhône", a: ["lyon"], b: ["saint-étienne", "st-étienne", "saint-etienne"] },
    { name: "Derby du Nord", a: ["lille"], b: ["lens"] },
  ],
};

const matches = (name: string, fragments: string[]) => fragments.some((f) => name.includes(f));

/** The named derby between two clubs in this league, if there is one. Names are matched loosely
    (lower-case, by fragment) because club labels vary ("Man United", "Manchester United"). */
export function findRivalry(leagueId: string | undefined, clubA: string, clubB: string): string | undefined {
  if (!leagueId) return undefined;
  const a = clubA.toLowerCase();
  const b = clubB.toLowerCase();
  const hit = (RIVALRIES[leagueId] ?? []).find(
    (r) => (matches(a, r.a) && matches(b, r.b)) || (matches(a, r.b) && matches(b, r.a)),
  );
  return hit?.name;
}

/**
 * One sentence about the user's most notable derby, from their own matches — undefined when the
 * league has no named derby against anyone they played (e.g. a fantasy-named club). Picks the derby
 * they did best in so a title-winning season doesn't lead with a thrashing.
 */
export function derbyLine(
  leagueId: string | undefined,
  userClubName: string,
  userClubId: string,
  userMatches: MatchSummaryDto[],
  nameFor: (clubId: string) => string,
): string | undefined {
  if (!leagueId) return undefined;
  const byDerby = new Map<string, { w: number; d: number; l: number; scores: string[]; points: number }>();
  for (const match of userMatches) {
    const row = summarizeForClub(match, userClubId);
    const derby = findRivalry(leagueId, userClubName, nameFor(row.opponentId));
    if (!derby) continue;
    const rec = byDerby.get(derby) ?? { w: 0, d: 0, l: 0, scores: [], points: 0 };
    if (row.result === "W") {
      rec.w++;
      rec.points += 3;
    } else if (row.result === "D") {
      rec.d++;
      rec.points += 1;
    } else rec.l++;
    rec.scores.push(`${row.yourScore}-${row.theirScore}`);
    byDerby.set(derby, rec);
  }
  if (byDerby.size === 0) return undefined;
  const [name, rec] = [...byDerby.entries()].sort((x, y) => y[1].points - x[1].points)[0]!;
  const scores = rec.scores.join(" and ");
  if (rec.w === rec.scores.length) return `${name} bragging rights: won both (${scores}).`;
  if (rec.l === rec.scores.length) return `The ${name} was a sore one — lost both (${scores}).`;
  if (rec.w > 0) return `The ${name} went your way overall (${scores}).`;
  return `The ${name} ended level on points (${scores}).`;
}
