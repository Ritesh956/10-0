import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MatchSummaryDto, WorldClubDto } from "../api/types";
import { Button } from "./ui/Button";
import { SPRING_SMOOTH } from "../lib/motion";
import { accumulateRecord, summarizeForClub, type ClubRecord } from "../lib/matchResult";
import { RESULT_BADGE, RESULT_ROW } from "./MatchLog";

interface Props {
  matches: MatchSummaryDto[];
  clubs: WorldClubDto[];
  userClubId: string | undefined;
  /** Minimum milliseconds each revealed card stays up before the next one appears. */
  intervalMs?: number;
  onComplete: () => void;
}

/** Extra hold time per goal the user's club scored in the just-revealed match, so a big win's
    card doesn't fly past before it's actually readable. */
const GOAL_HOLD_BONUS_MS = 220;

const cardVariants = {
  initial: { opacity: 0, y: -14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SPRING_SMOOTH },
};

function FeedCard({ clubId, match, nameFor }: { clubId: string; match: MatchSummaryDto; nameFor: (id: string) => string }) {
  const row = summarizeForClub(match, clubId);
  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="initial"
      animate="animate"
      className={`notch-sm flex items-center gap-3 border p-3 ${RESULT_ROW[row.result]}`}
    >
      <span
        className={`notch-sm flex h-7 w-7 shrink-0 items-center justify-center border font-display text-xs font-bold ${RESULT_BADGE[row.result]}`}
      >
        {row.result}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-paper">
          <span className="text-smoke-600">GW{match.matchday}</span> {nameFor(row.opponentId)}{" "}
          <span className="text-smoke-600">({row.isHome ? "H" : "A"})</span>
        </p>
        {row.yourGoals.length > 0 && (
          <p className="truncate text-xs text-smoke-500">
            &#9917; {row.yourGoals.map((g) => `${g.scorerName} ${g.minute}'`).join(", ")}
          </p>
        )}
      </div>
      <span className="shrink-0 font-display text-lg font-bold text-paper">
        {row.yourScore}-{row.theirScore}
      </span>
    </motion.div>
  );
}

/** The running W/D/L/Pts/GD line that accumulates alongside the feed as matches reveal, instead
    of only being knowable once the whole replay finishes. */
function StatStrip({ record }: { record: ClubRecord }) {
  const gd = record.goalsFor - record.goalsAgainst;
  return (
    <div className="notch grid grid-cols-4 gap-2 border border-ink-800 bg-ink-900/50 p-3 text-center">
      <div>
        <p className="font-display text-lg font-bold text-teal-400">{record.won}</p>
        <p className="text-[10px] uppercase tracking-wide text-smoke-600">Won</p>
      </div>
      <div>
        <p className="font-display text-lg font-bold text-paper">{record.drawn}</p>
        <p className="text-[10px] uppercase tracking-wide text-smoke-600">Drawn</p>
      </div>
      <div>
        <p className="font-display text-lg font-bold text-crimson-400">{record.lost}</p>
        <p className="text-[10px] uppercase tracking-wide text-smoke-600">Lost</p>
      </div>
      <div>
        <p className="font-display text-lg font-bold text-mint-400">{record.points}</p>
        <p className="text-[10px] uppercase tracking-wide text-smoke-600">Pts</p>
      </div>
      <div className="col-span-4 border-t border-ink-800 pt-2 text-xs text-smoke-500">
        GF {record.goalsFor} &middot; GA {record.goalsAgainst} &middot; GD {gd >= 0 ? "+" : ""}
        {gd}
      </div>
    </div>
  );
}

/** Streams a season's matches into a continuous, accumulating "results are rolling in" feed —
    newest card on top, exactly like watching a live scores ticker — instead of the one-at-a-time
    popup this replaced (which showed a single card, fully replacing it with the next). A running
    W/D/L/Pts/GD strip builds up alongside it, so the story of the run is legible as it goes rather
    than only knowable once every match has revealed. */
export function MatchPopupReel({ matches, clubs, userClubId, intervalMs = 1200, onComplete }: Props) {
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  // The first card appears immediately (computed as the initial state, not via an effect) —
  // otherwise the feed would sit blank for a render pass before anything shows up. Every
  // subsequent card waits out a hold timer instead.
  const [revealedCount, setRevealedCount] = useState(() => (matches.length > 0 ? 1 : 0));
  const [skipped, setSkipped] = useState(false);
  const completedRef = useRef(false);

  function fireOnce() {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }

  useEffect(() => {
    if (skipped) return;
    if (revealedCount >= matches.length) {
      fireOnce();
      return;
    }
    const justRevealed = matches[revealedCount - 1]!;
    const goalCount = userClubId ? summarizeForClub(justRevealed, userClubId).yourGoals.length : 0;
    const holdMs = intervalMs + goalCount * GOAL_HOLD_BONUS_MS;
    const timer = setTimeout(() => setRevealedCount((n) => n + 1), holdMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, matches, skipped, intervalMs]);

  function handleSkip() {
    setSkipped(true);
    fireOnce();
  }

  const revealed = matches.slice(0, revealedCount);
  const record = useMemo(
    () => (userClubId ? accumulateRecord(revealed, userClubId) : null),
    [revealed, userClubId],
  );

  if (!userClubId) return null; // nothing to summarize a "your results" feed against

  return (
    <div className="space-y-4">
      {revealed.length > 0 && (
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
          Matchday {revealed[revealed.length - 1]!.matchday} &middot; {revealed.length} / {matches.length}
        </p>
      )}

      <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin pr-1">
        {[...revealed].reverse().map((match) => (
          <FeedCard key={match.fixtureId} clubId={userClubId} match={match} nameFor={nameFor} />
        ))}
      </div>

      {record && <StatStrip record={record} />}

      {!skipped && revealedCount < matches.length && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip ahead &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
