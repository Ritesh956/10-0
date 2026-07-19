import { useEffect, useState } from "react";
import type { MatchSummaryDto, WorldClubDto } from "../api/types";
import { Button } from "./ui/Button";

interface Props {
  matches: MatchSummaryDto[];
  clubs: WorldClubDto[];
  /** Milliseconds each match popup stays on screen before auto-advancing. */
  intervalMs?: number;
  onComplete: () => void;
}

/** Plays a season's matches one at a time, like watching results roll in, instead of dumping the table. */
export function MatchPopupReel({ matches, clubs, intervalMs = 1500, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  useEffect(() => {
    if (index >= matches.length) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), intervalMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, matches.length, intervalMs]);

  if (index >= matches.length) return null;
  const match = matches[index]!;
  const homeGoals = match.goals.filter((g) => g.clubId === match.homeClubId);
  const awayGoals = match.goals.filter((g) => g.clubId === match.awayClubId);

  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">
        Matchday {match.matchday} &middot; {index + 1} / {matches.length}
      </p>

      <div
        key={match.fixtureId}
        className="notch animate-pop-in mx-auto max-w-sm border-2 border-ink-700 bg-ink-900/70 p-6"
      >
        <div className="flex items-center justify-center gap-3">
          <span className="min-w-0 flex-1 truncate text-right font-display text-lg font-bold uppercase tracking-tight text-paper">
            {nameFor(match.homeClubId)}
          </span>
          <span className="notch-sm shrink-0 border border-gold-500/40 bg-gold-500/10 px-3 py-1 font-display text-xl font-bold text-gold-400">
            {match.homeScore}-{match.awayScore}
          </span>
          <span className="min-w-0 flex-1 truncate text-left font-display text-lg font-bold uppercase tracking-tight text-paper">
            {nameFor(match.awayClubId)}
          </span>
        </div>

        {match.goals.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-smoke-400">
            <div className="space-y-1 text-right">
              {homeGoals.map((goal, i) => (
                <p key={i}>
                  &#9917; {goal.scorerName} {goal.minute}&apos;{goal.assistName ? ` (${goal.assistName})` : ""}
                </p>
              ))}
            </div>
            <div className="space-y-1 text-left">
              {awayGoals.map((goal, i) => (
                <p key={i}>
                  &#9917; {goal.scorerName} {goal.minute}&apos;{goal.assistName ? ` (${goal.assistName})` : ""}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onComplete}>
        Skip ahead &rarr;
      </Button>
    </div>
  );
}
