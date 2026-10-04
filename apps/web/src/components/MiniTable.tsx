import { motion } from "framer-motion";
import type { StandingsDto, WorldClubDto } from "../api/types";
import { worldClubLabel } from "../lib/clubNames";
import { CountryFlag } from "./CountryFlag";

interface Props {
  standings: StandingsDto | null;
  clubs: WorldClubDto[];
  userClubId: string | undefined;
  /** Rows shown either side of the user's club (2 → a five-row window). */
  radius?: number;
  title?: string;
}

/** The slice of the table around one club: `radius` rows above and below, with the window kept the
    same size at the top and bottom of the table instead of shrinking. */
export function tableWindow<T>(rows: T[], index: number, radius: number): { start: number; rows: T[] } {
  if (index < 0 || rows.length === 0) return { start: 0, rows: [] };
  const size = Math.min(rows.length, radius * 2 + 1);
  const start = Math.max(0, Math.min(index - radius, rows.length - size));
  return { start, rows: rows.slice(start, start + size) };
}

/**
 * A live "you are here" league table: your position ± a couple of rows, updating as matchdays
 * land. Something a fixtures-only feed can't show, since it needs every club's results.
 */
export function MiniTable({ standings, clubs, userClubId, radius = 2, title = "League table" }: Props) {
  if (!standings || !userClubId) return null;
  const index = standings.rows.findIndex((r) => r.clubId === userClubId);
  const { start, rows } = tableWindow(standings.rows, index, radius);
  if (rows.length === 0 || standings.rows.every((r) => r.played === 0)) return null;

  return (
    <div className="notch overflow-hidden border border-ink-800 bg-ink-900/40">
      <p className="border-b border-ink-800 px-3 py-1.5 text-center font-display text-[11px] font-semibold uppercase tracking-widest text-smoke-500">
        {title}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => {
            const mine = row.clubId === userClubId;
            const club = clubs.find((c) => c.id === row.clubId);
            const gd = row.goalsFor - row.goalsAgainst;
            return (
              <motion.tr
                key={row.clubId}
                layout
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className={mine ? "bg-mint-500/10 font-semibold text-paper" : "text-smoke-300"}
              >
                <td className="w-8 px-3 py-1.5 tabular-nums text-smoke-500">{start + i + 1}</td>
                <td className="px-1 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <CountryFlag country={club?.country ?? undefined} />
                    <span className="truncate">{worldClubLabel(club, row.clubId)}</span>
                    {mine && <span className="text-[10px] font-normal text-mint-400">(You)</span>}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-smoke-500">{row.played}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-smoke-500">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="px-3 py-1.5 text-center font-bold tabular-nums text-mint-400">{row.points}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
