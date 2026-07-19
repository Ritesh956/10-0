import type { TeamStatsDto } from "../api/types";

interface Props {
  stats: TeamStatsDto;
}

function StatChip({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="notch-sm border-2 border-ink-700 bg-ink-900/40 px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-smoke-600">{label}</p>
      <p className={`font-display font-bold ${small ? "truncate text-sm text-paper" : "text-2xl text-gold-400"}`}>{value}</p>
    </div>
  );
}

export function TeamStatsPanel({ stats }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Goals For" value={stats.goalsFor} />
        <StatChip label="Goals Against" value={stats.goalsAgainst} />
        <StatChip
          label="Top Scorer"
          value={stats.topScorer ? `${stats.topScorer.name} (${stats.topScorer.goals})` : "—"}
          small
        />
        <StatChip
          label="Top Assist"
          value={stats.topAssist ? `${stats.topAssist.name} (${stats.topAssist.assists})` : "—"}
          small
        />
      </div>

      <div className="notch overflow-x-auto border-2 border-ink-700">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left font-display text-xs uppercase tracking-widest text-smoke-600">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-center">MP</th>
              <th className="px-3 py-2 text-center">G</th>
              <th className="px-3 py-2 text-center">A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {stats.squad.map((row, i) => (
              <tr key={row.playerId} className={i % 2 === 0 ? "bg-ink-950" : "bg-ink-900/40"}>
                <td className="px-3 py-2 font-medium text-paper">{row.name}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.matchesPlayed}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.goals}</td>
                <td className="px-3 py-2 text-center text-smoke-400">{row.assists}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
