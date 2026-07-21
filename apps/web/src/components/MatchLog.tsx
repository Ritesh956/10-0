import { motion } from "framer-motion";
import type { MatchSummaryDto, WorldClubDto } from "../api/types";
import { staggerContainer, staggerItem } from "../lib/motion";

interface Props {
  matches: MatchSummaryDto[];
  clubs: WorldClubDto[];
  userClubId?: string | undefined;
}

type Result = "W" | "D" | "L";

const RESULT_BADGE: Record<Result, string> = {
  W: "border-teal-500/50 bg-teal-500/15 text-teal-300",
  D: "border-ink-600 bg-ink-800 text-smoke-400",
  L: "border-crimson-500/50 bg-crimson-500/15 text-crimson-300",
};

const RESULT_ROW: Record<Result, string> = {
  W: "border-teal-500/20 bg-teal-500/5",
  D: "border-ink-700 bg-ink-900/40",
  L: "border-crimson-500/20 bg-crimson-500/5",
};

/** Persistent, scrollable "your results" feed — most recent first — with a colored W/D/L badge
    and goalscorers per match, so a finished run's story stays browsable from the stats hub instead
    of only ever being visible once during the one-shot animated MatchPopupReel. */
export function MatchLog({ matches, clubs, userClubId }: Props) {
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  if (!userClubId || matches.length === 0) return null;

  const rows = matches
    .map((match) => {
      const isHome = match.homeClubId === userClubId;
      const opponentId = isHome ? match.awayClubId : match.homeClubId;
      const yourScore = isHome ? match.homeScore : match.awayScore;
      const theirScore = isHome ? match.awayScore : match.homeScore;
      const result: Result = yourScore > theirScore ? "W" : yourScore < theirScore ? "L" : "D";
      const yourGoals = match.goals.filter((g) => g.clubId === userClubId).sort((a, b) => a.minute - b.minute);
      return { match, isHome, opponentId, yourScore, theirScore, result, yourGoals };
    })
    .sort((a, b) => b.match.matchday - a.match.matchday);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      transition={{ staggerChildren: 0.02 }}
      className="notch max-h-96 space-y-2 overflow-y-auto border border-ink-800 bg-ink-900/30 p-3 scrollbar-thin"
    >
      {rows.map(({ match, isHome, opponentId, yourScore, theirScore, result, yourGoals }) => (
        <motion.div
          key={match.fixtureId}
          variants={staggerItem}
          className={`notch-sm flex items-center gap-3 border p-3 ${RESULT_ROW[result]}`}
        >
          <span
            className={`notch-sm flex h-7 w-7 shrink-0 items-center justify-center border font-display text-xs font-bold ${RESULT_BADGE[result]}`}
          >
            {result}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-paper">
              <span className="text-smoke-600">GW{match.matchday}</span> {nameFor(opponentId)}{" "}
              <span className="text-smoke-600">({isHome ? "H" : "A"})</span>
            </p>
            {yourGoals.length > 0 && (
              <p className="truncate text-xs text-smoke-500">
                &#9917; {yourGoals.map((g) => `${g.scorerName} ${g.minute}'`).join(", ")}
              </p>
            )}
          </div>
          <span className="shrink-0 font-display text-lg font-bold text-paper">
            {yourScore}-{theirScore}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}
