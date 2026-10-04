import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DailyArchiveRowDto, DailyMyArchiveDto } from "../api/types";
import { useAuth } from "../lib/auth-context";
import { formatDailyDate } from "./DailyChallengePage";

/** Every past Daily Challenge, newest first, with the community's numbers and your own score —
    each one still playable (38-0 keeps its archive behind a paywall; ours is free). */
export function DailyArchivePage() {
  const { isAuthenticated } = useAuth();
  const [rows, setRows] = useState<DailyArchiveRowDto[] | null>(null);
  const [mine, setMine] = useState<DailyMyArchiveDto>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDailyArchive()
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the archive");
      });
    if (isAuthenticated) {
      api
        .getMyDailyArchive()
        .then((m) => {
          if (!cancelled) setMine(m);
        })
        .catch(() => {
          // Your own scores are a bonus — the archive still works without them.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs text-smoke-500">
          <Link to="/daily" className="hover:text-paper">
            Daily Challenge
          </Link>{" "}
          › Archive
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">Past dailies</h1>
        <p className="text-sm text-smoke-500">
          Missed a day? Every puzzle stays open — same rules, five attempts, and your score joins that day&apos;s board.
        </p>
      </header>

      {error && <p className="text-sm text-crimson-400">{error}</p>}
      {!rows && !error && <p className="text-sm text-smoke-500">Loading the archive…</p>}
      {rows && rows.length === 0 && (
        <p className="text-sm text-smoke-500">
          No past dailies yet — <Link to="/daily" className="text-mint-400 underline">play today&apos;s</Link>.
        </p>
      )}

      <ul className="space-y-2">
        {rows?.map((row) => {
          const my = mine[row.id];
          const maxed = my && my.score >= my.maxScore;
          return (
            <li key={row.id}>
              <Link
                to={`/daily/${row.date}`}
                className="notch flex flex-wrap items-center gap-x-4 gap-y-1 border border-ink-800 bg-ink-900/50 px-4 py-3 transition hover:border-mint-500/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-smoke-500">{formatDailyDate(row.date)}</p>
                  <p className="font-display font-bold text-paper">{row.themeLabel}</p>
                  <p className="text-xs text-smoke-500">
                    {row.fixedFormation}
                    {row.anchorName ? ` · anchor ${row.anchorName}` : ""} · {row.players} played
                    {row.topScore !== null ? ` · top ${row.topScore}/${row.maxScore}` : ""}
                  </p>
                </div>
                <span
                  className={`notch-sm border px-2 py-1 text-xs font-semibold ${
                    my
                      ? maxed
                        ? "border-mint-500/50 text-mint-300"
                        : "border-ink-600 text-paper"
                      : "border-amber-500/40 text-amber-300"
                  }`}
                >
                  {my ? `You: ${my.score}/${my.maxScore}` : "Play"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
