import type { ReactNode } from "react";
import type { LeaderboardDifficulty, LeaderboardRatingsMode, LeaderboardTimeWindow } from "../api/types";
import type { Formation } from "../lib/formations";
import { FORMATIONS } from "../lib/formations";
import type { SquadTier } from "../lib/squadRatings";
import { Chip } from "./ui/Chip";

export type LeaderboardMode = "solo" | "one-club";

export interface LeaderboardFiltersState {
  mode: LeaderboardMode | "all";
  difficulty: LeaderboardDifficulty | "all";
  ratingsMode: LeaderboardRatingsMode | "all";
  formation: Formation | "all";
  leagueName: string | "all";
  timeWindow: LeaderboardTimeWindow;
  squadTier: SquadTier | "all";
}

export const DEFAULT_LEADERBOARD_FILTERS: LeaderboardFiltersState = {
  mode: "all",
  difficulty: "all",
  ratingsMode: "all",
  formation: "all",
  leagueName: "all",
  timeWindow: "all",
  squadTier: "all",
};

const SQUAD_TIERS: SquadTier[] = ["Galácticos", "Elite", "Strong", "Mid-table", "Budget", "Minnows"];

interface Props {
  filters: LeaderboardFiltersState;
  onChange: (patch: Partial<LeaderboardFiltersState>) => void;
  leagueNames: string[];
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-smoke-600">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** 38-0 §9's filter panel (Club/Time window/Formation/Squad tier/Difficulty/Ratings mode), minus a
    Chip-row "Club" axis (173 real clubs is too many for a chip row — LeaderboardPage instead deep
    links a specific club via refClubId/?clubId=, shown as a standalone context chip above this
    panel, not a Row here) and plus a Mode axis (Solo vs One-Club XI, Phase 7) and a League axis, a
    genuine top-5-over-38-0's-one-league addition. Squad tier is filtered client-side (squadTierName's
    thresholds already live in lib/squadRatings.ts; no need to duplicate them on the backend) — every
    other axis is a real server-side query filter. */
export function LeaderboardFilters({ filters, onChange, leagueNames }: Props) {
  return (
    <div className="notch space-y-4 border border-ink-800 bg-ink-900/50 p-4">
      <Row label="Mode">
        <Chip active={filters.mode === "all"} onClick={() => onChange({ mode: "all" })}>
          All
        </Chip>
        <Chip active={filters.mode === "solo"} onClick={() => onChange({ mode: "solo" })}>
          Solo
        </Chip>
        <Chip active={filters.mode === "one-club"} onClick={() => onChange({ mode: "one-club" })}>
          One-Club XI
        </Chip>
      </Row>

      <Row label="Time window">
        {(["all", "week", "today"] as const).map((tw) => (
          <Chip key={tw} active={filters.timeWindow === tw} onClick={() => onChange({ timeWindow: tw })}>
            {tw === "all" ? "All time" : tw === "week" ? "This week" : "Today"}
          </Chip>
        ))}
      </Row>

      <Row label="Difficulty">
        <Chip active={filters.difficulty === "all"} onClick={() => onChange({ difficulty: "all" })}>
          All
        </Chip>
        {(["easy", "normal", "hard"] as const).map((d) => (
          <Chip key={d} active={filters.difficulty === d} onClick={() => onChange({ difficulty: d })}>
            {d[0]!.toUpperCase() + d.slice(1)}
          </Chip>
        ))}
      </Row>

      <Row label="Ratings mode">
        <Chip active={filters.ratingsMode === "all"} onClick={() => onChange({ ratingsMode: "all" })}>
          Any
        </Chip>
        {(["season", "prime"] as const).map((r) => (
          <Chip key={r} active={filters.ratingsMode === r} onClick={() => onChange({ ratingsMode: r })}>
            {r[0]!.toUpperCase() + r.slice(1)}
          </Chip>
        ))}
      </Row>

      <Row label="League">
        <Chip active={filters.leagueName === "all"} onClick={() => onChange({ leagueName: "all" })}>
          All
        </Chip>
        {leagueNames.map((name) => (
          <Chip key={name} active={filters.leagueName === name} onClick={() => onChange({ leagueName: name })}>
            {name}
          </Chip>
        ))}
      </Row>

      <Row label="Squad tier">
        <Chip active={filters.squadTier === "all"} onClick={() => onChange({ squadTier: "all" })}>
          All
        </Chip>
        {SQUAD_TIERS.map((tier) => (
          <Chip key={tier} active={filters.squadTier === tier} onClick={() => onChange({ squadTier: tier })}>
            {tier}
          </Chip>
        ))}
      </Row>

      <Row label="Formation">
        <Chip active={filters.formation === "all"} onClick={() => onChange({ formation: "all" })}>
          Any
        </Chip>
        {FORMATIONS.map((f) => (
          <Chip key={f} active={filters.formation === f} onClick={() => onChange({ formation: f })}>
            {f}
          </Chip>
        ))}
      </Row>
    </div>
  );
}
