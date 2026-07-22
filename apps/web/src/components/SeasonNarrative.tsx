import { motion } from "framer-motion";
import type { SeasonNarrative as SeasonNarrativeData } from "../lib/seasonNarrative";
import { staggerContainer, staggerItem } from "../lib/motion";

interface Props {
  narrative: SeasonNarrativeData;
}

/** Renders the auto-generated season narrative (verdict tag, finish paragraph, unit composition,
    January recap, standout-player quote, manager closing line) — a template-bank narrative, no
    LLM involved; every piece of text comes from lib/seasonNarrative.ts's pure signal functions. */
export function SeasonNarrative({ narrative }: Props) {
  const { verdict, unitTiers, compositionSentence, finishParagraph, januaryLines, standout, managerLine } = narrative;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="notch space-y-4 border border-ink-800 bg-ink-900/50 p-6 text-left"
    >
      <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Season Story</h2>
        <span className={`notch-sm border border-current/30 px-3 py-1 text-xs font-bold uppercase tracking-wide ${verdict.colorClass}`}>
          {verdict.label}
        </span>
      </motion.div>

      <motion.p variants={staggerItem} className="text-sm text-smoke-300">
        {finishParagraph}
      </motion.p>

      {unitTiers && compositionSentence && (
        <motion.div variants={staggerItem} className="space-y-2 border-t border-ink-800 pt-3">
          <p className="text-sm text-smoke-300">{compositionSentence}</p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="notch-sm border border-crimson-500/30 bg-crimson-500/5 px-2 py-1 text-crimson-300">
              Attack: {unitTiers.attack}
            </span>
            <span className="notch-sm border border-mint-500/30 bg-mint-500/5 px-2 py-1 text-mint-300">
              Midfield: {unitTiers.midfield}
            </span>
            <span className="notch-sm border border-teal-500/30 bg-teal-500/5 px-2 py-1 text-teal-300">
              Defence: {unitTiers.defence}
            </span>
            <span className="notch-sm border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-amber-300">
              Goalkeeping: {unitTiers.goalkeeping}
            </span>
          </div>
        </motion.div>
      )}

      {januaryLines.length > 0 && (
        <motion.div variants={staggerItem} className="space-y-1 border-t border-ink-800 pt-3 text-sm text-smoke-300">
          {januaryLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </motion.div>
      )}

      {standout && (
        <motion.div variants={staggerItem} className="border-t border-ink-800 pt-3">
          <p className="text-sm font-semibold text-paper">{standout.line}</p>
          <p className="mt-1 text-xs italic text-smoke-500">&#127908; {standout.aside}</p>
        </motion.div>
      )}

      {managerLine && (
        <motion.p variants={staggerItem} className="border-t border-ink-800 pt-3 text-sm text-smoke-400">
          {managerLine}
        </motion.p>
      )}
    </motion.div>
  );
}
