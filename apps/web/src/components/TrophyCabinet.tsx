import { motion } from "framer-motion";
import type { TrophyKey } from "../api/types";
import { TROPHY_CATALOG } from "../lib/trophies";
import { staggerContainer, staggerItemBounce } from "../lib/motion";

interface Props {
  trophies: TrophyKey[];
}

/** Shows every trophy unlocked this run (Achievement rows persisted by SeasonsService.finalizeRun),
    on both the results screen and the history page. Renders nothing for an empty cabinet — a
    non-winning season isn't a broken/empty state, it's just the common case. */
export function TrophyCabinet({ trophies }: Props) {
  if (trophies.length === 0) return null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {trophies.map((key) => {
        const meta = TROPHY_CATALOG[key];
        return (
          <motion.div
            key={key}
            variants={staggerItemBounce}
            className={`notch space-y-1 border-2 bg-ink-900/50 p-4 text-center ${meta.colorClass}`}
          >
            <p className="text-2xl">{meta.icon}</p>
            <p className="font-display text-sm font-bold uppercase tracking-wide text-paper">{meta.name}</p>
            <p className="text-xs text-smoke-500">{meta.description}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
