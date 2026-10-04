import type { KnockoutRound } from "../api/types";

/** A coloured band of a standings table (e.g. a qualification zone). */
export interface TableZone {
  /** Tailwind `border-l-*` class painted on the row's left edge. */
  border: string;
  /** Legend colour dot. */
  dot: string;
  label: string;
}

/** Knockout rounds in the order they're played. */
export const EUROPE_STAGES: KnockoutRound[] = ["PO", "R16", "QF", "SF", "FINAL"];

/** Plural, for a bracket section heading. */
export const ROUND_HEADING: Record<KnockoutRound, string> = {
  PO: "Play-offs",
  R16: "Round of 16",
  QF: "Quarter-Finals",
  SF: "Semi-Finals",
  FINAL: "Final",
};

/** Singular, for "<Round> results" and "Simulating the <Round>…". */
export const ROUND_LABEL: Record<KnockoutRound, string> = {
  PO: "Play-off",
  R16: "Round of 16",
  QF: "Quarter-Final",
  SF: "Semi-Final",
  FINAL: "Final",
};

/** Lower-case, for "Out in the <round>". */
export const ROUND_NAME: Record<KnockoutRound, string> = {
  PO: "play-off",
  R16: "round of 16",
  QF: "quarter-final",
  SF: "semi-final",
  FINAL: "final",
};

/** Mirrors the API's european-format.ts: 36 clubs, the top 8 skip the play-off, 9–24 play it. */
export const DIRECT_QUALIFIERS = 8;

export type LeaguePhaseZone = "R16" | "PO" | "OUT";

export function leaguePhaseZone(position: number): LeaguePhaseZone {
  if (position <= DIRECT_QUALIFIERS) return "R16";
  if (position <= DIRECT_QUALIFIERS * 3) return "PO";
  return "OUT";
}

const ZONES: Record<LeaguePhaseZone, TableZone> = {
  R16: { border: "border-l-mint-400", dot: "bg-mint-400", label: "Round of 16 (1–8)" },
  PO: { border: "border-l-amber-400", dot: "bg-amber-400", label: "Play-off (9–24)" },
  OUT: { border: "border-l-crimson-500/70", dot: "bg-crimson-500/70", label: "Eliminated (25–36)" },
};

/** For StandingsTable's `zoneFor` / `legend` on the league-phase table. */
export const zoneForPosition = (position: number): TableZone => ZONES[leaguePhaseZone(position)];
export const ZONE_LEGEND: TableZone[] = [ZONES.R16, ZONES.PO, ZONES.OUT];

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = ["th", "st", "nd", "rd"];
  return `${n}${suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]}`;
}

/** One line on where the user's finish sends them. */
export function leaguePhaseVerdict(position: number): string {
  const zone = leaguePhaseZone(position);
  if (zone === "R16") return `Finished ${ordinal(position)} — straight through to the Round of 16.`;
  if (zone === "PO") return `Finished ${ordinal(position)} — into the play-off round.`;
  return `Finished ${ordinal(position)} — eliminated at the league phase.`;
}
