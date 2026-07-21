import { motion } from "framer-motion";
import type { KnockoutRound, KnockoutTieDto, WorldClubDto } from "../api/types";
import { staggerContainer, staggerItem } from "../lib/motion";

interface Props {
  ties: KnockoutTieDto[];
  clubs: WorldClubDto[];
  highlightClubId?: string | undefined;
}

const ROUND_ORDER: KnockoutRound[] = ["QF", "SF", "FINAL"];
const ROUND_LABEL: Record<KnockoutRound, string> = { QF: "Quarter-Finals", SF: "Semi-Finals", FINAL: "Final" };

export function KnockoutBracket({ ties, clubs, highlightClubId }: Props) {
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;
  const rounds = ROUND_ORDER.map((round) => ({ round, ties: ties.filter((t) => t.round === round) })).filter(
    (group) => group.ties.length > 0,
  );

  return (
    <div className="space-y-5">
      {rounds.map(({ round, ties: roundTies }) => (
        <div key={round}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-smoke-600">{ROUND_LABEL[round]}</p>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
            {roundTies.map((tie) => {
              const homeWon = tie.winnerClubId === tie.homeClubId;
              const awayWon = tie.winnerClubId === tie.awayClubId;
              return (
                <motion.div
                  key={tie.id}
                  variants={staggerItem}
                  className={`notch-sm flex items-center justify-between gap-2 border-2 px-3 py-2 text-sm ${
                    tie.homeClubId === highlightClubId || tie.awayClubId === highlightClubId
                      ? "border-gold-500/50 bg-gold-500/5"
                      : "border-ink-700 bg-ink-900/40"
                  }`}
                >
                  <span className={`min-w-0 flex-1 truncate ${homeWon ? "font-bold text-gold-300" : "text-paper"}`}>
                    {nameFor(tie.homeClubId)}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase text-smoke-600">
                    {round === "FINAL" ? "final" : "vs"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-right ${awayWon ? "font-bold text-gold-300" : "text-paper"}`}>
                    {nameFor(tie.awayClubId)}
                  </span>
                  {tie.winnerClubId && (
                    <span className="shrink-0 notch-sm border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-smoke-500">
                      {tie.wentToPenalties ? "pens" : "won"}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
