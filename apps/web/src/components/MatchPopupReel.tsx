import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import type { MatchGoalDto, MatchSummaryDto, WorldClubDto } from "../api/types";
import { Button } from "./ui/Button";
import { SPRING_SMOOTH } from "../lib/motion";

interface Props {
  matches: MatchSummaryDto[];
  clubs: WorldClubDto[];
  /** Minimum milliseconds each match popup stays on screen before auto-advancing. */
  intervalMs?: number;
  onComplete: () => void;
}

const ENTER_MS = 250;
const GOAL_STAGGER_MS = 130;
const SETTLE_BUFFER_MS = 500;
const SCORE_COUNT_MS = 550;

const cardVariants = {
  initial: { opacity: 0, scale: 0.94, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING_SMOOTH },
  exit: { opacity: 0, scale: 0.97, y: -8, transition: { duration: 0.18 } },
};

const goalListVariants = {
  animate: { transition: { staggerChildren: GOAL_STAGGER_MS / 1000 } },
};

const goalItemVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
};

/** Ticks two scores up from 0 to their final values over SCORE_COUNT_MS, resetting on each match. */
function useScoreCountUp(homeScore: number, awayScore: number, key: string) {
  const [display, setDisplay] = useState({ home: 0, away: 0 });

  useEffect(() => {
    setDisplay({ home: 0, away: 0 });
    const controls = animate(0, 1, {
      duration: SCORE_COUNT_MS / 1000,
      ease: "easeOut",
      onUpdate: (t) => {
        setDisplay({ home: Math.round(t * homeScore), away: Math.round(t * awayScore) });
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return display;
}

function GoalList({ goals, align }: { goals: MatchGoalDto[]; align: "left" | "right" }) {
  return (
    <motion.div
      variants={goalListVariants}
      initial="initial"
      animate="animate"
      className={`space-y-1 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {goals.map((goal, i) => (
        <motion.p key={i} variants={goalItemVariants}>
          &#9917; {goal.scorerName} {goal.minute}&apos;{goal.assistName ? ` (${goal.assistName})` : ""}
        </motion.p>
      ))}
    </motion.div>
  );
}

/** forwardRef is required here — AnimatePresence attaches a ref directly to whatever
    element sits inside it to track when the exit animation actually finishes; a plain
    function component silently swallows that ref (React warns, and exit-completion never fires). */
const MatchCard = forwardRef<HTMLDivElement, { match: MatchSummaryDto; nameFor: (clubId: string) => string }>(
  function MatchCard({ match, nameFor }, ref) {
    const homeGoals = match.goals.filter((g) => g.clubId === match.homeClubId).sort((a, b) => a.minute - b.minute);
    const awayGoals = match.goals.filter((g) => g.clubId === match.awayClubId).sort((a, b) => a.minute - b.minute);
    const score = useScoreCountUp(match.homeScore, match.awayScore, match.fixtureId);

    return (
      <motion.div
        ref={ref}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="notch mx-auto max-w-sm border-2 border-ink-700 bg-ink-900/70 p-6"
      >
        <div className="flex items-center justify-center gap-3">
          <span className="min-w-0 flex-1 truncate text-right font-display text-lg font-bold uppercase tracking-tight text-paper">
            {nameFor(match.homeClubId)}
          </span>
          <span className="notch-sm shrink-0 border border-gold-500/40 bg-gold-500/10 px-3 py-1 font-display text-xl font-bold text-gold-400">
            {score.home}-{score.away}
          </span>
          <span className="min-w-0 flex-1 truncate text-left font-display text-lg font-bold uppercase tracking-tight text-paper">
            {nameFor(match.awayClubId)}
          </span>
        </div>

        {match.goals.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-smoke-400">
            <GoalList goals={homeGoals} align="right" />
            <GoalList goals={awayGoals} align="left" />
          </div>
        )}
      </motion.div>
    );
  },
);

/** Plays a season's matches one at a time, like watching results roll in, instead of dumping the table. */
export function MatchPopupReel({ matches, clubs, intervalMs = 1500, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  const match = index < matches.length ? matches[index] : undefined;

  // Give goal-heavy matches enough time to actually read the staggered reveal, instead of a fixed
  // interval that either rushes a 5-goal match or leaves a scoreless one sitting idle.
  const holdMs = useMemo(() => {
    if (!match) return intervalMs;
    const goalTime = ENTER_MS + match.goals.length * GOAL_STAGGER_MS + SETTLE_BUFFER_MS;
    return Math.max(intervalMs, SCORE_COUNT_MS + goalTime);
  }, [match, intervalMs]);

  // "ending": ran out of matches naturally — wait for the last card's exit transition before
  // calling onComplete. "skipped": the user bailed — call onComplete immediately, don't make
  // them wait for any animation, and just let the exit play out visually in the background.
  const [phase, setPhase] = useState<"playing" | "ending" | "skipped">("playing");
  // AnimatePresence's onExitComplete fires after EVERY card-to-card exit, not just the final
  // one — and by the time it actually calls back, the closure it captured can be stale relative
  // to the current phase, so the check needs a ref that's always current, not `phase` directly.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const completedRef = useRef(false);

  function fireOnce() {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }

  useEffect(() => {
    if (phase !== "playing") return;
    if (!match) {
      setPhase("ending");
      // Nothing was ever rendered, so AnimatePresence has nothing to exit — its
      // onExitComplete will never fire, so don't wait on it.
      if (matches.length === 0) fireOnce();
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), holdMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, holdMs, phase]);

  function handleSkip() {
    setPhase("skipped");
    fireOnce();
  }

  function handleExitComplete() {
    if (phaseRef.current === "ending") fireOnce();
  }

  return (
    <div className="space-y-4 text-center">
      {phase === "playing" && match && (
        <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">
          Matchday {match.matchday} &middot; {index + 1} / {matches.length}
        </p>
      )}

      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        {phase === "playing" && match && <MatchCard key={match.fixtureId} match={match} nameFor={nameFor} />}
      </AnimatePresence>

      {phase === "playing" && (
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Skip ahead &rarr;
        </Button>
      )}
    </div>
  );
}
