import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { NationDto } from "../api/types";
import { initials } from "../lib/positionColors";
import { useDraft } from "../state/DraftContext";

/** Nations Trophy directory (38-0 §7d, Phase 10): every nationality represented in the top-5
    catalog as a card. Picking one locks the draft to only players of that nationality, drawn from
    across all five leagues — the nationality-locked sibling of ClubsDirectoryPage's club lock.
    Routes into /setup (not straight to /draft) so formation/difficulty/managers/toggles stay
    configurable; SetupPage/DraftPage adapt (nation summary panel, nationality-filtered pool) when
    a nation is locked. */
export function NationsDirectoryPage() {
  const navigate = useNavigate();
  const { setConfig, setSquadName, squadName, resetDraft } = useDraft();

  const [nations, setNations] = useState<NationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void api
      .listNations()
      .then(setNations)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load nations"));
  }, []);

  const filtered = useMemo(() => {
    if (!nations) return null;
    const q = search.trim().toLowerCase();
    if (!q) return nations;
    return nations.filter((n) => n.nationality.toLowerCase().includes(q));
  }, [nations, search]);

  function pickNation(nation: NationDto) {
    resetDraft();
    setConfig({
      eraId: "era-all-time",
      leagueIds: [],
      lockedNationality: nation.nationality,
      lockedClubId: undefined,
      lockedClubName: undefined,
      eraYearMin: undefined,
      eraYearMax: undefined,
    });
    if (!squadName) setSquadName(`${nation.nationality} XI`);
    navigate("/setup");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">Nations Trophy</h1>
        <p className="mt-2 text-sm text-smoke-500">
          Pick a nation and draft your all-time XI from every player of that nationality across the top-5 leagues.
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search nations..."
        className="notch-sm mx-auto block w-full max-w-sm border border-ink-800 bg-ink-950 px-4 py-2 text-center text-sm text-paper outline-none focus:border-mint-500/60"
      />

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
      {!filtered && !error && <p className="text-center text-sm text-smoke-500">Loading nations...</p>}
      {filtered && filtered.length === 0 && (
        <p className="text-center text-sm text-smoke-500">No nations match &quot;{search}&quot;.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered?.map((nation) => (
          <div
            key={nation.nationality}
            className="notch flex flex-col items-center gap-2 border border-ink-800 bg-ink-900/50 p-4 text-center transition hover:border-plum-500/60 hover:bg-ink-900/80"
          >
            <button type="button" onClick={() => pickNation(nation)} className="flex flex-col items-center gap-2">
              <span className="notch-sm flex h-12 w-12 items-center justify-center bg-plum-500/15 font-display text-sm font-bold text-plum-300">
                {initials(nation.nationality)}
              </span>
              <span className="font-display text-sm font-semibold leading-tight text-paper">{nation.nationality}</span>
              <span className="text-[11px] text-smoke-500">{nation.playerCount} players</span>
            </button>
            <Link
              to={`/leaderboard?mode=nations&nationality=${encodeURIComponent(nation.nationality)}`}
              className="text-[10px] text-teal-400 underline hover:text-teal-300"
            >
              View leaderboard
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
