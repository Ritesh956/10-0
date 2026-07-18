import type { StandingsDto, WorldClubDto } from "../api/types";

interface Props {
  standings: StandingsDto;
  clubs: WorldClubDto[];
  highlightClubId?: string | undefined;
}

export function StandingsTable({ standings, clubs, highlightClubId }: Props) {
  const nameFor = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? clubId;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
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
        <tbody className="divide-y divide-slate-800">
          {standings.rows.map((row, i) => (
            <tr
              key={row.clubId}
              className={row.clubId === highlightClubId ? "bg-emerald-500/10" : i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/40"}
            >
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{nameFor(row.clubId)}</td>
              <td className="px-3 py-2 text-center">{row.played}</td>
              <td className="px-3 py-2 text-center">{row.won}</td>
              <td className="px-3 py-2 text-center">{row.drawn}</td>
              <td className="px-3 py-2 text-center">{row.lost}</td>
              <td className="px-3 py-2 text-center">{row.goalsFor}</td>
              <td className="px-3 py-2 text-center">{row.goalsAgainst}</td>
              <td className="px-3 py-2 text-center">{row.goalsFor - row.goalsAgainst}</td>
              <td className="px-3 py-2 text-center font-bold text-emerald-400">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
