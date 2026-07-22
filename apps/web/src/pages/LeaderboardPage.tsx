import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { LeaderboardEntryDto } from "../api/types";
import { DEFAULT_LEADERBOARD_FILTERS, LeaderboardFilters, type LeaderboardFiltersState } from "../components/LeaderboardFilters";
import { Button } from "../components/ui/Button";
import { formatLeaderboardResult } from "../lib/leaderboardResult";
import { squadTierName, TIER_TEXT } from "../lib/squadRatings";
import { isRealCountry } from "../lib/leagues";
import { useAuth } from "../lib/auth-context";

type Tab = "global" | "friends";

/** 38-0 §9's `/leaderboard`: Global (ranked-by-points, filterable) + a Friends tab that stubs to
    "sign in to add friends" until a real friend graph exists — this app has no such graph at all
    yet, so the stub applies regardless of auth state, not just to guests. */
export function LeaderboardPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("global");
  const [filters, setFilters] = useState<LeaderboardFiltersState>(() => {
    // Deep-link support (Phase 7): ClubsDirectoryPage's "View leaderboard" card action links here
    // with ?mode=one-club&clubId=X&clubName=Y — read once at mount, same as a normal initial state.
    const mode = searchParams.get("mode");
    return mode === "one-club" ? { ...DEFAULT_LEADERBOARD_FILTERS, mode: "one-club" } : DEFAULT_LEADERBOARD_FILTERS;
  });
  // A specific club, deep-linked or picked from the Mode row — kept separate from the Chip-row
  // filters above since 173 real clubs is far too many to render as a chip row (see
  // LeaderboardFilters's doc comment); shown instead as a standalone context chip with its own clear.
  const [clubFilter, setClubFilter] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("clubId");
    const name = searchParams.get("clubName");
    return id && name ? { id, name } : null;
  });
  const [entries, setEntries] = useState<LeaderboardEntryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leagueNames, setLeagueNames] = useState<string[]>([]);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void api
      .listLeagues()
      .then((leagues) => {
        const names = [...new Set(leagues.filter((l) => isRealCountry(l.country)).map((l) => l.name))].sort();
        setLeagueNames(names);
      })
      .catch(() => {
        // Non-fatal — the League filter row just shows no options beyond "All".
      });
  }, []);

  useEffect(() => {
    setEntries(null);
    void api
      .getLeaderboard({
        timeWindow: filters.timeWindow,
        limit: 50,
        ...(filters.mode === "all" ? {} : { mode: filters.mode }),
        ...(filters.difficulty === "all" ? {} : { difficulty: filters.difficulty }),
        ...(filters.ratingsMode === "all" ? {} : { ratingsMode: filters.ratingsMode }),
        ...(filters.formation === "all" ? {} : { formation: filters.formation }),
        ...(filters.leagueName === "all" ? {} : { leagueName: filters.leagueName }),
        ...(clubFilter ? { refClubId: clubFilter.id } : {}),
      })
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load the leaderboard"));
  }, [filters.mode, filters.difficulty, filters.ratingsMode, filters.formation, filters.leagueName, filters.timeWindow, clubFilter]);

  // Squad tier has no server-side column (its thresholds already live client-side in
  // lib/squadRatings.ts) — filtered here instead of round-tripping the same bucketing to the API.
  const visibleEntries = useMemo(() => {
    if (!entries) return null;
    if (filters.squadTier === "all") return entries;
    return entries.filter((e) => squadTierName(e.squadOverall) === filters.squadTier);
  }, [entries, filters.squadTier]);

  async function handleReport(entryId: string) {
    try {
      await api.reportLeaderboardEntry(entryId);
      setReportedIds((prev) => new Set(prev).add(entryId));
    } catch {
      // Best-effort — reporting failing quietly isn't worth surfacing an error banner over.
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-center font-display text-3xl font-bold uppercase tracking-wide text-paper">Leaderboard</h1>
      <p className="text-center text-sm text-smoke-500">Best top-5 European XIs · ranked by points.</p>

      <div className="flex justify-center gap-2">
        <Button variant={tab === "global" ? "primary" : "outline"} size="sm" onClick={() => setTab("global")}>
          Global
        </Button>
        <Button variant={tab === "friends" ? "primary" : "outline"} size="sm" onClick={() => setTab("friends")}>
          Friends
        </Button>
      </div>

      {tab === "friends" && (
        <p className="notch border border-ink-800 bg-ink-900/50 p-6 text-center text-sm text-smoke-500">
          Friends leaderboards need an account-linked friend graph, which doesn't exist yet.{" "}
          {!isAuthenticated && (
            <>
              For now,{" "}
              <Link to="/signin" className="text-mint-400 underline">
                sign in
              </Link>{" "}
            </>
          )}
          Check back soon.
        </p>
      )}

      {tab === "global" && (
        <>
          {clubFilter && (
            <div className="flex justify-center">
              <span className="notch-sm inline-flex items-center gap-2 border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-300">
                {clubFilter.name}
                <button
                  type="button"
                  onClick={() => setClubFilter(null)}
                  className="text-teal-400 hover:text-teal-200"
                  title="Clear club filter"
                >
                  &times;
                </button>
              </span>
            </div>
          )}

          <LeaderboardFilters filters={filters} onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))} leagueNames={leagueNames} />

          {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
          {!visibleEntries && !error && <p className="text-center text-sm text-smoke-500">Loading...</p>}
          {visibleEntries && visibleEntries.length === 0 && (
            <p className="text-center text-sm text-smoke-500">No runs match these filters yet.</p>
          )}

          <div className="space-y-2">
            {visibleEntries?.map((entry, index) => {
              const tier = squadTierName(entry.squadOverall);
              return (
                <div
                  key={entry.id}
                  className="notch flex flex-wrap items-center justify-between gap-3 border border-ink-800 bg-ink-900/50 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-8 shrink-0 text-center font-display text-lg font-bold text-smoke-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-display text-sm font-bold text-paper">
                        {entry.handle}
                        {entry.verified && (
                          <span title="Server-simulated run" className="text-mint-400">
                            ✓
                          </span>
                        )}
                        <span className="notch-sm border border-ink-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-smoke-500">
                          {entry.difficulty}
                        </span>
                      </p>
                      <p className="truncate text-xs text-smoke-500">
                        {entry.clubName} &middot; {entry.formation} &middot;{" "}
                        <span className={TIER_TEXT[tier]}>{tier}</span> ({entry.squadOverall}) &middot;{" "}
                        {entry.ratingsMode === "prime" ? "Prime" : "Season"}
                        {entry.leagueName ? ` · ${entry.leagueName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <p className="font-display text-sm font-bold text-paper">{formatLeaderboardResult(entry)}</p>
                      <p className="text-xs text-smoke-500">{entry.points} PTS</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReport(entry.id)}
                      disabled={reportedIds.has(entry.id)}
                      title="Report this name"
                      className="text-xs text-smoke-600 transition hover:text-crimson-400 disabled:cursor-not-allowed disabled:text-crimson-500"
                    >
                      {reportedIds.has(entry.id) ? "⚐ Reported" : "⚐"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
