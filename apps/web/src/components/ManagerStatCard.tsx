import type { ManagerStatsDto, WorldClubDto } from "../api/types";

interface Props {
  stats: ManagerStatsDto;
  clubs: WorldClubDto[];
}

function nameFor(clubs: WorldClubDto[], clubId: string): string {
  return clubs.find((c) => c.id === clubId)?.name ?? clubId;
}

/** Clean Sheets / Longest Win Streak / Biggest Win / Highest-Scoring match, attributed to the
    world club's manager (38-0 §6f) — a manager-less club still shows the four stat tiles, just
    without the name/philosophy header above them. */
export function ManagerStatCard({ stats, clubs }: Props) {
  const hasAnyStat =
    stats.cleanSheets > 0 || stats.longestWinStreak > 0 || Boolean(stats.biggestWin) || Boolean(stats.highestScoringMatch);
  if (!stats.manager && !hasAnyStat) return null;

  return (
    <div className="notch space-y-4 border border-ink-800 bg-ink-900/50 p-5">
      {stats.manager && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">{stats.manager.nationality}</p>
          <h3 className="font-display text-lg font-bold text-paper">{stats.manager.name}</h3>
          {stats.manager.philosophy && <p className="mt-1 text-sm text-smoke-400">{stats.manager.philosophy}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div>
          <p className="font-display text-xl font-bold text-teal-400">{stats.cleanSheets}</p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Clean Sheets</p>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-mint-400">{stats.longestWinStreak}</p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Longest Win Streak</p>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-paper">
            {stats.biggestWin ? `${stats.biggestWin.ourScore}-${stats.biggestWin.theirScore}` : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">
            Biggest Win{stats.biggestWin ? ` vs ${nameFor(clubs, stats.biggestWin.opponentClubId)}` : ""}
          </p>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-paper">
            {stats.highestScoringMatch ? `${stats.highestScoringMatch.ourScore}-${stats.highestScoringMatch.theirScore}` : "—"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">
            Highest-Scoring{stats.highestScoringMatch ? ` vs ${nameFor(clubs, stats.highestScoringMatch.opponentClubId)}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
