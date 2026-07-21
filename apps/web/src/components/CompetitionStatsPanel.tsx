import { motion } from "framer-motion";
import type { CompetitionStatsDto } from "../api/types";
import { staggerContainer, staggerItem } from "../lib/motion";

interface Props {
  stats: CompetitionStatsDto;
  highlightClubId?: string | undefined;
}

function AwardChip({ label, value, sub, isYou }: { label: string; value: string; sub?: string; isYou?: boolean }) {
  return (
    <div className="notch-sm border-2 border-gold-500/40 bg-gold-500/5 px-4 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-smoke-600">{label}</p>
      <p className="truncate font-display text-lg font-bold text-gold-400">{value}</p>
      {sub && (
        <p className="truncate text-xs text-smoke-500">
          {sub}
          {isYou && <span className="ml-1 text-gold-400">(You)</span>}
        </p>
      )}
    </div>
  );
}

/** Competition-wide leaderboard (Golden Boot, MVP, top scorers across every club) — distinct from
    TeamStatsPanel, which is scoped to just the user's own squad. */
export function CompetitionStatsPanel({ stats, highlightClubId }: Props) {
  if (!stats.goldenBoot && !stats.mvp && stats.topScorers.length === 0) return null;

  return (
    <div className="space-y-4">
      {(stats.goldenBoot ?? stats.mvp) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.goldenBoot && (
            <AwardChip
              label="Golden Boot"
              value={`${stats.goldenBoot.name} — ${stats.goldenBoot.goals}`}
              sub={stats.goldenBoot.clubName}
              isYou={stats.goldenBoot.clubId === highlightClubId}
            />
          )}
          {stats.mvp && (
            <AwardChip
              label="MVP"
              value={`${stats.mvp.name} — ${stats.mvp.avgRating.toFixed(1)}`}
              sub={stats.mvp.clubName}
              isYou={stats.mvp.clubId === highlightClubId}
            />
          )}
        </div>
      )}

      {stats.topScorers.length > 0 && (
        <div className="notch overflow-x-auto border-2 border-ink-700">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left font-display text-xs uppercase tracking-widest text-smoke-600">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Club</th>
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
              {stats.topScorers.map((row, i) => (
                <motion.tr
                  key={row.playerId}
                  variants={staggerItem}
                  className={`${i % 2 === 0 ? "bg-ink-950" : "bg-ink-900/40"} ${
                    row.clubId === highlightClubId ? "text-gold-400" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-smoke-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-paper">{row.name}</td>
                  <td className="px-3 py-2 text-smoke-400">
                    {row.clubName}
                    {row.clubId === highlightClubId && <span className="ml-1 text-gold-400">(You)</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-smoke-400">{row.goals}</td>
                  <td className="px-3 py-2 text-center text-smoke-400">{row.assists}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
