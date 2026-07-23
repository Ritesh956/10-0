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
  /** While true, more matches are still being simulated/streamed in — the reel keeps revealing what
      it has but must NOT fire `onComplete` on catching up (more cards are still coming). The driver
      flips this to false once the season is fully simulated, letting the reel finish naturally. */
  streaming?: boolean;
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
export function MatchPopupReel({ matches, clubs, userClubId, intervalMs = 1200, streaming = false, onComplete }: Props) {
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  // When the full match list is known up front (non-streaming callers), the first card appears
  // immediately. When streaming, `matches` starts empty and grows as the worker finishes matchdays,
  // so we start at 0 and let the effect reveal the first card the moment one arrives.
  const [revealedCount, setRevealedCount] = useState(() => (matches.length > 0 && !streaming ? 1 : 0));
  const [skipped, setSkipped] = useState(false);
  const completedRef = useRef(false);
  // Read the latest matches through a ref so the hold-timer effect can depend on `matches.length`
  // (which only changes when a genuinely new match streams in) rather than the array identity
  // (a fresh reference every parent render, which would otherwise reset the timer mid-hold and stall
  // the reveal while the driver is polling).
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  function fireOnce() {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }

  useEffect(() => {
    if (skipped) return;
    if (revealedCount >= matches.length) {
      // Caught up (this also covers the empty-list case where both are 0). Only finish if no more
      // are coming — while streaming, hold and wait for the next matchday to stream in (this effect
      // re-runs when matches.length grows).
      if (!streaming) fireOnce();
      return;
    }
    // Matches exist but nothing revealed yet (streaming: they arrived after mount): reveal the first.
    // Ordered after the check above so matches[revealedCount-1] is never indexed at -1.
    if (revealedCount === 0) {
      setRevealedCount(1);
      return;
    }
    const justRevealed = matchesRef.current[revealedCount - 1]!;
    const goalCount = userClubId ? summarizeForClub(justRevealed, userClubId).yourGoals.length : 0;
    const holdMs = intervalMs + goalCount * GOAL_HOLD_BONUS_MS;
    const timer = setTimeout(() => setRevealedCount((n) => n + 1), holdMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, matches.length, skipped, intervalMs, streaming]);

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

  // While streaming, the reel has caught up to everything simulated so far and is waiting for the
  // next matchday's result to land.
  const awaitingNext = streaming && revealedCount >= matches.length;

  return (
    <div className="space-y-4">
      {revealed.length > 0 && (
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
          Matchday {revealed[revealed.length - 1]!.matchday} &middot; {revealed.length}
          {streaming ? "" : ` / ${matches.length}`} played
        </p>
      )}

      <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin pr-1">
        {[...revealed].reverse().map((match) => (
          <FeedCard key={match.fixtureId} clubId={userClubId} match={match} nameFor={nameFor} />
        ))}
      </div>

      {awaitingNext && (
        <p className="animate-mint-pulse text-center text-xs font-semibold uppercase tracking-widest text-mint-400">
          {revealed.length > 0 ? "Results rolling in…" : "Kicking off…"}
        </p>
      )}

      {record && <StatStrip record={record} />}

      {!skipped && (streaming || revealedCount < matches.length) && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip ahead &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
