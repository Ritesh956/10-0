import type { JanuaryResultDto, MatchSummaryDto, SquadPositionOverallDto, TeamStatsDto } from "../api/types";
import { computePreseasonOdds } from "./preseasonOdds";
import { POSITION_GROUP, type Position } from "./formations";
import { summarizeForClub } from "./matchResult";

/** Auto-generated end-of-season narrative (38-0 §6b) — a template bank keyed by signals, no LLM.
    Every signal is pure and unit-testable in isolation; buildSeasonNarrative() just assembles them
    from data the stats-hub already has cached (standings/summary/teamStats/matches/januaryOutcome/
    manager), so nothing here needs its own fetch or its own cache slot. */

export interface VerdictTag {
  label: string;
  colorClass: string;
}

/** Finished-vs-projected delta → phrase + color. Recomputes a "projected finish" from the squad's
    overall via the same computePreseasonOdds used at draft time, rather than persisting the
    pre-season projection anywhere — the projection is a pure function of overall alone, so it's
    always cheaply re-derivable instead of needing new storage. Falls back to a position-only
    heuristic when no squad overall is available (e.g. an AI-only world). */
export function computeVerdict(position: number, seasonSize: number, squadOverall: number | undefined): VerdictTag {
  if (squadOverall === undefined) {
    if (position <= Math.max(1, Math.ceil(seasonSize * 0.2))) return { label: "STRONG SEASON", colorClass: "text-mint-400" };
    if (position > seasonSize - Math.max(1, Math.ceil(seasonSize * 0.15))) {
      return { label: "TOUGH SEASON", colorClass: "text-crimson-400" };
    }
    return { label: "AS EXPECTED", colorClass: "text-smoke-400" };
  }
  const projectedFinish = computePreseasonOdds(squadOverall).projectedFinish;
  const delta = projectedFinish - position; // positive = finished better than projected (lower position number)
  if (delta >= 4) return { label: "OVERACHIEVED", colorClass: "text-mint-400" };
  if (delta <= -4) return { label: "FLATTERED TO DECEIVE", colorClass: "text-crimson-400" };
  return { label: "AS EXPECTED", colorClass: "text-smoke-400" };
}

const UNIT_TIER_BANDS: { min: number; label: string }[] = [
  { min: 85, label: "Elite" },
  { min: 78, label: "Excellent" },
  { min: 70, label: "Strong" },
  { min: 62, label: "Very good" },
  { min: 52, label: "Solid" },
  { min: 0, label: "Shaky" },
];

/** Per-unit overall → band label. Separate scale/labels from lib/squadRatings.ts's whole-squad
    tier names (Galácticos/Elite/...) — this narrates one of the four tactical units, not the XI as
    a whole, so it deliberately doesn't reuse those tier names. */
export function unitTierLabel(rating: number): string {
  return UNIT_TIER_BANDS.find((b) => rating >= b.min)!.label;
}

export interface UnitRatings {
  attack: number;
  midfield: number;
  defence: number;
  goalkeeping: number;
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

/** Groups the starting XI's position/overall pairs into the four tactical units, the same
    grouping DraftPage's live squad-ratings panel already does client-side (lib/formations.ts's
    POSITION_GROUP) — kept in this one place rather than duplicated on the backend. */
export function groupSquadUnits(squad: SquadPositionOverallDto[]): UnitRatings {
  const groups: Record<"GK" | "DEF" | "MID" | "ATT", number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of squad) {
    const group = POSITION_GROUP[p.position as Position] ?? "MID";
    groups[group].push(p.overall);
  }
  return {
    attack: average(groups.ATT),
    midfield: average(groups.MID),
    defence: average(groups.DEF),
    goalkeeping: average(groups.GK),
  };
}

/** Names the squad's strongest + weakest unit — the "composition sentence" signal. */
export function compositionSentence(units: UnitRatings): string {
  const entries = Object.entries(units) as [keyof UnitRatings, number][];
  const strongest = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const weakest = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (strongest[0] === weakest[0]) return `A balanced squad built around its ${strongest[0]}.`;
  return `Built on a ${unitTierLabel(strongest[1]).toLowerCase()} ${strongest[0]}, undermined at times by a shakier ${weakest[0]}.`;
}

export type FinishBracket = "champion" | "top4" | "europa" | "mid-table" | "relegation-scrap" | "relegated";

/** Bracket (champion / top-4 / Europa / mid-table / relegation-scrap / relegated) from a finish
    position and the season's total club count — never hardcoded to 20, so an 18-club league
    (Bundesliga/Ligue 1) gets a proportionally-sized relegation zone rather than a fixed count. */
export function computeFinishBracket(position: number, seasonSize: number): FinishBracket {
  const relegationZoneSize = Math.max(3, Math.round(seasonSize * 0.15));
  if (position === 1) return "champion";
  if (position <= 4) return "top4";
  if (position <= 6) return "europa";
  if (position > seasonSize - relegationZoneSize) return "relegated";
  if (position > seasonSize - relegationZoneSize - 3) return "relegation-scrap";
  return "mid-table";
}

/** The user's biggest league win this season, as prose — undefined if they never won a match. */
export function biggestWinText(matches: MatchSummaryDto[], clubId: string, nameFor: (clubId: string) => string): string | undefined {
  let best: { margin: number; text: string } | undefined;
  for (const match of matches) {
    const row = summarizeForClub(match, clubId);
    if (row.result !== "W") continue;
    const margin = row.yourScore - row.theirScore;
    if (!best || margin > best.margin) {
      best = { margin, text: `a ${row.yourScore}-${row.theirScore} win over ${nameFor(row.opponentId)}` };
    }
  }
  return best?.text;
}

/** The templated finish-position flavor paragraph, with slots for the points total and (when one
    exists) the season's biggest win. */
export function finishParagraph(
  bracket: FinishBracket,
  position: number,
  points: number,
  clubName: string,
  winText: string | undefined,
): string {
  const winClause = winText ? ` The high point was ${winText}.` : "";
  switch (bracket) {
    case "champion":
      return `${clubName} went all the way, lifting the title with ${points} points.${winClause}`;
    case "top4":
      return `A top-four finish (#${position}) with ${points} points — European football is secured.${winClause}`;
    case "europa":
      return `#${position} with ${points} points, just outside the very top — a season with real European ambition.${winClause}`;
    case "mid-table":
      return `A steady #${position} finish on ${points} points, comfortably clear of any relegation worries.${winClause}`;
    case "relegation-scrap":
      return `A nervy #${position} finish on ${points} points — safety came, but it was closer than anyone wanted.${winClause}`;
    case "relegated":
      return `Relegation. #${position} finish with just ${points} points to show for the campaign.${winClause}`;
  }
}

/** One line for the arrival, one for the departure — only present when a January gamble happened. */
export function januaryLines(outcome: JanuaryResultDto | null | undefined): string[] {
  if (!outcome) return [];
  return [
    `In January, ${outcome.inPlayer.name} arrived (OVR ${outcome.inPlayer.overall}) from ${outcome.inPlayer.clubName} ${outcome.inPlayer.seasonYear}.`,
    `${outcome.outPlayer.name} (OVR ${outcome.outPlayer.overall}) made way for them — a swing of ${outcome.delta > 0 ? "+" : ""}${outcome.delta} OVR.`,
  ];
}

export interface StandoutQuote {
  line: string;
  aside: string;
}

/** The standout performer — whichever of the top scorer/top assister contributed more (by
    goals+assists) — with a bold headline plus an italic pundit-quote aside. */
export function standoutQuote(teamStats: TeamStatsDto | null | undefined): StandoutQuote | undefined {
  const scorer = teamStats?.topScorer;
  const assister = teamStats?.topAssist;
  const candidate =
    scorer && assister
      ? scorer.goals + scorer.assists >= assister.goals + assister.assists
        ? scorer
        : assister
      : (scorer ?? assister);
  if (!candidate) return undefined;

  const contribution =
    candidate.goals > 0 && candidate.assists > 0
      ? `${candidate.goals} goals and ${candidate.assists} assists`
      : candidate.goals > 0
        ? `${candidate.goals} goals`
        : `${candidate.assists} assists`;
  const lastName = candidate.name.trim().split(/\s+/).slice(-1)[0];

  return {
    line: `${candidate.name} was the standout, with ${contribution} in ${candidate.matchesPlayed} appearances.`,
    aside: `"Every squad needs a player who shows up when it matters — that was ${lastName} this year."`,
  };
}

/** Echoes the manager's own philosophy blurb + the season's shape — undefined for a manager-less club. */
export function managerClosingLine(philosophy: string | null | undefined, clubName: string): string | undefined {
  if (!philosophy) return undefined;
  return `True to the manager's word — "${philosophy}" — ${clubName} played exactly the way they were set up to.`;
}

export interface SeasonNarrativeInput {
  position: number;
  seasonSize: number;
  points: number;
  clubName: string;
  userClubId: string;
  squadOverall: number | undefined;
  squad: SquadPositionOverallDto[] | undefined;
  matches: MatchSummaryDto[];
  teamStats: TeamStatsDto | null | undefined;
  januaryOutcome: JanuaryResultDto | null | undefined;
  managerPhilosophy: string | null | undefined;
  nameFor: (clubId: string) => string;
}

export interface SeasonNarrative {
  verdict: VerdictTag;
  unitTiers: { attack: string; midfield: string; defence: string; goalkeeping: string } | undefined;
  compositionSentence: string | undefined;
  finishParagraph: string;
  januaryLines: string[];
  standout: StandoutQuote | undefined;
  managerLine: string | undefined;
}

/** Assembles every signal above into one narrative bundle. Pure — safe to call directly from a
    render body every time (no need to cache the result separately; everything it's fed is already
    cached). */
export function buildSeasonNarrative(input: SeasonNarrativeInput): SeasonNarrative {
  const verdict = computeVerdict(input.position, input.seasonSize, input.squadOverall);
  const units = input.squad && input.squad.length > 0 ? groupSquadUnits(input.squad) : undefined;
  const unitTiers = units
    ? {
        attack: unitTierLabel(units.attack),
        midfield: unitTierLabel(units.midfield),
        defence: unitTierLabel(units.defence),
        goalkeeping: unitTierLabel(units.goalkeeping),
      }
    : undefined;
  const bracket = computeFinishBracket(input.position, input.seasonSize);
  const winText = biggestWinText(input.matches, input.userClubId, input.nameFor);

  return {
    verdict,
    unitTiers,
    compositionSentence: units ? compositionSentence(units) : undefined,
    finishParagraph: finishParagraph(bracket, input.position, input.points, input.clubName, winText),
    januaryLines: januaryLines(input.januaryOutcome),
    standout: standoutQuote(input.teamStats),
    managerLine: managerClosingLine(input.managerPhilosophy, input.clubName),
  };
}
