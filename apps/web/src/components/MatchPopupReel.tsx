import { worldClubLabel } from "../lib/clubNames";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MatchSummaryDto, WorldClubDto } from "../api/types";
import { Button } from "./ui/Button";
import { SPRING_SMOOTH } from "../lib/motion";
import { accumulateRecord, summarizeForClub, type ClubRecord } from "../lib/matchResult";
import { surname } from "../lib/positionColors";
import { RESULT_BADGE, RESULT_ROW } from "./MatchLog";

interface Props {
  matches: MatchSummaryDto[];
  /** Already-played matches from before this reveal (e.g. the first half, when resuming after the
      January window). Shown at once beneath the new cards and counted in the played total and the
      W/D/L strip, so the season reads as one continuous run rather than restarting at 0. */
  priorMatches?: MatchSummaryDto[];
  clubs: WorldClubDto[];
  userClubId: string | undefined;
  /** Minimum milliseconds each revealed card stays up before the next one appears. Overrides the
      viewer's speed setting (tests use it to pin timing). */
  intervalMs?: number;
  /** Label for the skip button — "Skip to January" for a first half that stops at the window. */
  skipLabel?: string;
  /** While true, more matches are still being simulated/streamed in — the reel keeps revealing what
      it has but must NOT fire `onComplete` on catching up (more cards are still coming). The driver
      flips this to false once the season is fully simulated, letting the reel finish naturally. */
  streaming?: boolean;
  onComplete: () => void;
}

/** Extra hold time per goal the user's club scored in the just-revealed match (scaled by speed), so
    a big win's card doesn't fly past before it's actually readable. */
const GOAL_HOLD_BONUS_MS = 220;

/** Per-card hold by speed. 1x used to be 1.2s+ (90s+ for a season vs 38-0's ~25s); now a 38-game
    reveal takes ~30s at 1x and ~12s at 2x, with Skip for the impatient. */
export const REVEAL_SPEEDS = { "1x": 650, "2x": 260, "4x": 90 } as const;
export type RevealSpeed = keyof typeof REVEAL_SPEEDS;
const SPEED_STORAGE_KEY = "futbol_reveal_speed";

function loadSpeed(): RevealSpeed {
  try {
    const stored = localStorage.getItem(SPEED_STORAGE_KEY);
    if (stored && stored in REVEAL_SPEEDS) return stored as RevealSpeed;
  } catch {
    // storage blocked — default speed
  }
  return "1x";
}

/** Cards shown before older ones collapse behind a "show all" toggle (no nested scroll box). */
const VISIBLE_CARDS = 6;

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
            &#9917; {row.yourGoals.map((g) => `${surname(g.scorerName)} ${g.minute}'`).join(", ")}
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
        <p className="font-display text-lg font-bold text-mint-400">{record.won}</p>
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
        <p className="font-display text-lg font-bold text-paper">{record.points}</p>
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
export function MatchPopupReel({
  matches,
  priorMatches = [],
  clubs,
  userClubId,
  intervalMs,
  skipLabel = "Skip ahead",
  streaming = false,
  onComplete,
}: Props) {
  const nameFor = (clubId: string) => worldClubLabel(clubs.find((c) => c.id === clubId), clubId);
  const [speed, setSpeed] = useState<RevealSpeed>(loadSpeed);
  const [showAll, setShowAll] = useState(false);
  const holdBase = intervalMs ?? REVEAL_SPEEDS[speed];

  function changeSpeed(next: RevealSpeed) {
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_STORAGE_KEY, next);
    } catch {
      // storage blocked — the choice just won't stick
    }
  }

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
    const holdMs = holdBase + goalCount * GOAL_HOLD_BONUS_MS * (holdBase / REVEAL_SPEEDS["1x"]);
    const timer = setTimeout(() => setRevealedCount((n) => n + 1), holdMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, matches.length, skipped, holdBase, streaming]);

  function handleSkip() {
    setSkipped(true);
    fireOnce();
  }

  const revealed = [...priorMatches, ...matches.slice(0, revealedCount)];
  const totalMatches = priorMatches.length + matches.length;
  const record = useMemo(
    () => (userClubId ? accumulateRecord(revealed, userClubId) : null),
    [revealed, userClubId],
  );

  if (!userClubId) return null; // nothing to summarize a "your results" feed against

  // While streaming, the reel has caught up to everything simulated so far and is waiting for the
  // next matchday's result to land.
  const awaitingNext = streaming && revealedCount >= matches.length;

  const newestFirst = [...revealed].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, VISIBLE_CARDS);
  const running = !skipped && (streaming || revealedCount < matches.length);

  return (
    <div className="space-y-4">
      {revealed.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">
            Matchday {revealed[revealed.length - 1]!.matchday} &middot; {revealed.length}
            {streaming ? "" : ` / ${totalMatches}`} played
          </p>
          {running && intervalMs === undefined && (
            <div className="notch-sm flex items-center gap-0.5 border border-ink-700 bg-ink-900/40 p-0.5 text-[11px]" role="group" aria-label="Reveal speed">
              {(Object.keys(REVEAL_SPEEDS) as RevealSpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => changeSpeed(s)}
                  className={`notch-sm px-2 py-0.5 font-semibold transition ${speed === s ? "bg-mint-500/15 text-mint-300" : "text-smoke-500 hover:text-paper"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {record && <StatStrip record={record} />}

      <div className="space-y-2" aria-live="polite" aria-relevant="additions">
        {visible.map((match) => (
          <FeedCard key={match.fixtureId} clubId={userClubId} match={match} nameFor={nameFor} />
        ))}
      </div>
      {newestFirst.length > VISIBLE_CARDS && (
        <div className="text-center">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs text-smoke-500 underline-offset-2 hover:text-paper hover:underline">
            {showAll ? "Show fewer" : `Show all ${newestFirst.length} results`}
          </button>
        </div>
      )}

      {awaitingNext && (
        <p className="animate-mint-pulse text-center text-xs font-semibold uppercase tracking-widest text-mint-400">
          {revealed.length > 0 ? "Results rolling in…" : "Kicking off…"}
        </p>
      )}

      {running && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            {skipLabel} &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
