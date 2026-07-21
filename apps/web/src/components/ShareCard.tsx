import { useEffect } from "react";
import { motion } from "framer-motion";
import type { SummaryDto } from "../api/types";
import { fireTitleBurst, fireUnbeatenBurst } from "../lib/confetti";
import { SPRING_BOUNCY } from "../lib/motion";

interface Props {
  summary: SummaryDto;
}

export function ShareCard({ summary }: Props) {
  const { userClub, userRow, position, unbeaten, shareText } = summary;

  useEffect(() => {
    if (!userClub || !userRow) return;
    if (unbeaten) fireUnbeatenBurst();
    else if (position === 1) fireTitleBurst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyToClipboard() {
    if (shareText) await navigator.clipboard.writeText(shareText);
  }

  if (!userClub || !userRow) return null;

  return (
    <div
      className={`notch relative overflow-hidden border-2 p-8 text-center shadow-2xl ${
        unbeaten
          ? "border-amber-400/70 bg-gradient-to-br from-amber-500/20 via-ink-900 to-ink-950"
          : "border-ink-700 bg-gradient-to-br from-teal-500/10 via-ink-900 to-ink-950"
      }`}
    >
      {unbeaten && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={SPRING_BOUNCY}
          className="notch-sm absolute right-4 top-4 border-2 border-amber-300 bg-amber-400 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-ink-950"
        >
          Unbeaten
        </motion.div>
      )}
      <p className="text-xs uppercase tracking-[0.3em] text-smoke-600">Season Result</p>
      <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-paper">{userClub.name}</h2>
      <p className="mt-1 text-sm text-smoke-500">Finished {position ? `#${position}` : "—"} in the table</p>

      <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-4 text-center">
        <div>
          <div className="font-display text-2xl font-bold text-teal-400">{userRow.won}</div>
          <div className="text-xs uppercase text-smoke-600">Won</div>
        </div>
        <div>
          <div className="font-display text-2xl font-bold text-smoke-400">{userRow.drawn}</div>
          <div className="text-xs uppercase text-smoke-600">Drawn</div>
        </div>
        <div>
          <div className="font-display text-2xl font-bold text-crimson-400">{userRow.lost}</div>
          <div className="text-xs uppercase text-smoke-600">Lost</div>
        </div>
      </div>

      <p className="mt-6 text-lg font-bold text-paper">
        {userRow.goalsFor}-{userRow.goalsAgainst}{" "}
        <span className="text-sm font-normal text-smoke-500">goals for/against</span>
      </p>

      <button
        onClick={copyToClipboard}
        className="notch-sm mt-8 border-2 border-paper bg-paper px-5 py-2 text-sm font-display font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-mint-300 hover:border-mint-300"
      >
        Copy result to share
      </button>
    </div>
  );
}
