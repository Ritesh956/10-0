import { motion } from "framer-motion";
import type { TeamStatsDto } from "../api/types";
import { staggerContainer, staggerItem } from "../lib/motion";

interface Props {
  stats: TeamStatsDto;
  /** The club's league record, if known — renders an extra W/D/L/Pts row so this panel doesn't
      read as goals-only. Optional since not every caller has standings on hand. */
  record?: { won: number; drawn: number; lost: number; points: number } | undefined;
}

type Tone = "mint" | "teal" | "crimson" | "plum" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  mint: "text-mint-400",
  teal: "text-teal-400",
  crimson: "text-crimson-400",
  plum: "text-plum-400",
  neutral: "text-smoke-400",
};

function StatChip({
  label,
  value,
  small,
  tone = "mint",
}: {
  label: string;
  value: string | number;
  small?: boolean;
  tone?: Tone;
}) {
  return (
    <div className="notch-sm border border-ink-800 bg-ink-900/40 px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-smoke-600">{label}</p>
      <p className={`font-display font-bold ${small ? "truncate text-sm text-paper" : `text-2xl ${TONE_TEXT[tone]}`}`}>{value}</p>
    </div>
  );
}

export function TeamStatsPanel({ stats, record }: Props) {
  return (
    <div className="space-y-4">
      {record && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip label="Won" value={record.won} tone="teal" />
          <StatChip label="Drawn" value={record.drawn} tone="neutral" />
          <StatChip label="Lost" value={record.lost} tone="crimson" />
          <StatChip label="Points" value={record.points} tone="mint" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Goals For" value={stats.goalsFor} tone="teal" />
        <StatChip label="Goals Against" value={stats.goalsAgainst} tone="crimson" />
        <StatChip
          label="Top Scorer"
          value={stats.topScorer ? `${stats.topScorer.name} (${stats.topScorer.goals})` : "—"}
          small
        />
        <StatChip
          label="Top Assist"
          value={stats.topAssist ? `${stats.topAssist.name} (${stats.topAssist.assists})` : "—"}
          small
          tone="plum"
        />
      </div>

      <div className="notch overflow-x-auto border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left font-display text-xs uppercase tracking-widest text-smoke-600">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-center">MP</th>
              <th className="px-3 py-2 text-center">G</th>
              <th className="px-3 py-2 text-center">A</th>
            </tr>
          </thead>
          <motion.tbody
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.03 }}
            className="divide-y divide-ink-800"
          >
            {stats.squad.map((row, i) => (
              <motion.tr key={row.playerId} variants={staggerItem} className={i % 2 === 0 ? "bg-ink-950" : "bg-ink-900/40"}>
                <td className="px-3 py-2 font-medium text-paper">{row.name}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.matchesPlayed}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.goals}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.assists}</td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
