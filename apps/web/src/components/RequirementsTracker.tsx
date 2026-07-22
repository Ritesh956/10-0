import { motion } from "framer-motion";
import type { DailyConstraintDto } from "../api/types";
import { SPRING_SMOOTH } from "../lib/motion";

interface Props {
  constraints: DailyConstraintDto[];
  /** Aligned with `constraints` — matches banked so far, from lib/dailyOdds.ts's countMatches. */
  matchedByConstraint: number[];
  /** 0-100, from lib/dailyOdds.ts's computeCompletionOdds. */
  completionOdds: number;
}

function oddsColorClass(pct: number): string {
  if (pct >= 60) return "bg-mint-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-crimson-500";
}

function StatusDot({ met }: { met: boolean }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${met ? "bg-mint-500" : "bg-ink-700"}`} />;
}

/** 38-0 §7c's requirements checklist + live "COMPLETION ODDS %" readout — sits where the OVERALL
    panel sits in Classic draft mode. Odds shown once at the top (repeated per-requirement fractions
    below it do the same job at the per-constraint level). */
export function RequirementsTracker({ constraints, matchedByConstraint, completionOdds }: Props) {
  return (
    <div className="notch space-y-4 border border-ink-800 bg-ink-900/60 p-4">
      <div>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-smoke-500">
          <span>Completion Odds</span>
          <span className="font-display text-sm font-bold text-paper">{completionOdds}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full bg-ink-800">
          <motion.div
            className={`h-full ${oddsColorClass(completionOdds)}`}
            initial={{ width: 0 }}
            animate={{ width: `${completionOdds}%` }}
            transition={SPRING_SMOOTH}
          />
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wide text-smoke-500">Requirements</p>
        {constraints.map((constraint, i) => {
          const matched = Math.min(matchedByConstraint[i] ?? 0, constraint.required);
          const met = matched >= constraint.required;
          return (
            <div key={`${constraint.type}-${constraint.value}`} className="flex items-center gap-2.5">
              <StatusDot met={met} />
              <span className={`flex-1 text-sm ${met ? "text-paper" : "text-smoke-400"}`}>{constraint.description}</span>
              <span className={`font-display text-xs font-bold ${met ? "text-mint-400" : "text-smoke-500"}`}>
                {matched}/{constraint.required}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
