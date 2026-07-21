import { motion } from "framer-motion";
import type { StandingsDto, WorldClubDto } from "../api/types";
import { staggerContainer, staggerItem } from "../lib/motion";

interface Props {
  standings: StandingsDto;
  clubs: WorldClubDto[];
  highlightClubId?: string | undefined;
}

export function StandingsTable({ standings, clubs, highlightClubId }: Props) {
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  return (
    <div className="notch overflow-x-auto border-2 border-ink-700">
      <table className="w-full text-sm">
        <thead className="bg-ink-900 text-left font-display text-xs uppercase tracking-widest text-smoke-600">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Club</th>
            <th className="px-3 py-2 text-center">P</th>
            <th className="px-3 py-2 text-center">W</th>
            <th className="px-3 py-2 text-center">D</th>
            <th className="px-3 py-2 text-center">L</th>
            <th className="px-3 py-2 text-center">GF</th>
            <th className="px-3 py-2 text-center">GA</th>
            <th className="px-3 py-2 text-center">GD</th>
            <th className="px-3 py-2 text-center font-bold">Pts</th>
          </tr>
        </thead>
        <motion.tbody
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          transition={{ staggerChildren: 0.03 }}
          className="divide-y divide-ink-800"
        >
          {standings.rows.map((row, i) => (
            <motion.tr
              key={row.clubId}
              variants={staggerItem}
              className={row.clubId === highlightClubId ? "bg-gold-500/10" : i % 2 === 0 ? "bg-ink-950" : "bg-ink-900/40"}
            >
              <td className="px-3 py-2 text-smoke-600">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-paper">{nameFor(row.clubId)}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.played}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.won}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.drawn}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.lost}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.goalsFor}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.goalsAgainst}</td>
              <td className="px-3 py-2 text-center text-smoke-400">{row.goalsFor - row.goalsAgainst}</td>
              <td className="px-3 py-2 text-center font-bold text-gold-400">{row.points}</td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
