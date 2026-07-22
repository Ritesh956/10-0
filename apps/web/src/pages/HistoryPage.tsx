import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { WorldHistoryRowDto } from "../api/types";
import { TrophyCabinet } from "../components/TrophyCabinet";

/** "Your history" (38-0 §7b/§6g): every world the signed-in user has ever drafted, with its
    headline result (points, from the WorldRecord SeasonsService.finalizeRun persists) and unlocked
    trophies — a world whose run was never finalized (still in progress, or never reached the
    stats hub) just shows "In progress" instead of a result. */
export function HistoryPage() {
  const [rows, setRows] = useState<WorldHistoryRowDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getHistory()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-center font-display text-3xl font-bold uppercase tracking-wide text-paper">Your History</h1>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
      {!rows && !error && <p className="text-center text-sm text-smoke-500">Loading...</p>}
      {rows && rows.length === 0 && (
        <p className="text-center text-sm text-smoke-500">
          No runs yet —{" "}
          <Link to="/setup" className="text-mint-400 underline">
            start a draft
          </Link>{" "}
          to begin your history.
        </p>
      )}

      <div className="space-y-4">
        {rows?.map((row) => (
          <div key={row.worldId} className="notch space-y-3 border border-ink-800 bg-ink-900/50 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold text-paper">{row.clubName ?? "Unnamed XI"}</p>
                <p className="text-xs text-smoke-500">
                  {row.formation ?? "—"} &middot; {new Date(row.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="font-display text-xl font-bold text-mint-400">
                {row.pointsTotal !== null ? `${row.pointsTotal} pts` : "In progress"}
              </p>
            </div>
            <TrophyCabinet trophies={row.trophies} />
          </div>
        ))}
      </div>
    </div>
  );
}
