import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { RealClubDto } from "../api/types";
import { initials } from "../lib/positionColors";
import { useDraft } from "../state/DraftContext";

/** One-Club XI directory (38-0 §7b, Phase 7): every real top-5 club as a card. Picking one locks
    the draft to that club's entire real history (across every season it has in the dataset) rather
    than a league — DraftPage's pool fetch branches on config.lockedClubId to draw from it. Routes
    into /setup (not straight to /draft) so formation/difficulty/managers/toggles are still
    configurable; SetupPage itself adapts (hides League, forces Season ratings) when a club is locked. */
export function ClubsDirectoryPage() {
  const navigate = useNavigate();
  const { setConfig, setSquadName, squadName, resetDraft } = useDraft();

  const [clubs, setClubs] = useState<RealClubDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void api
      .listClubs()
      .then(setClubs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load clubs"));
  }, []);

  const filtered = useMemo(() => {
    if (!clubs) return null;
    const q = search.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q));
  }, [clubs, search]);

  function pickClub(club: RealClubDto) {
    resetDraft();
    setConfig({
      eraId: "era-all-time",
      leagueIds: [club.currentLeagueId],
      lockedClubId: club.id,
      lockedClubName: club.name,
      playerRatings: "season",
      eraYearMin: undefined,
      eraYearMax: undefined,
    });
    // Only fill in a default name if the user hasn't already typed one this session — matches
    // DraftPage's own "untouched squadName defaults, doesn't clobber" convention.
    if (!squadName) setSquadName(`${club.name} All-Time XI`);
    navigate("/setup");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">One-Club XI</h1>
        <p className="mt-2 text-sm text-smoke-500">
          Pick a real club and draft your all-time greatest XI from their entire history — any era, any season.
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search clubs or countries..."
        className="notch-sm mx-auto block w-full max-w-sm border border-ink-800 bg-ink-950 px-4 py-2 text-center text-sm text-paper outline-none focus:border-mint-500/60"
      />

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
      {!filtered && !error && <p className="text-center text-sm text-smoke-500">Loading clubs...</p>}
      {filtered && filtered.length === 0 && (
        <p className="text-center text-sm text-smoke-500">No clubs match &quot;{search}&quot;.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered?.map((club) => (
          <div
            key={club.id}
            className="notch flex flex-col items-center gap-2 border border-ink-800 bg-ink-900/50 p-4 text-center transition hover:border-mint-500/60 hover:bg-ink-900/80"
          >
            <button type="button" onClick={() => pickClub(club)} className="flex flex-col items-center gap-2">
              {club.badgeRef ? (
                <img
                  src={club.badgeRef}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="notch-sm flex h-12 w-12 items-center justify-center bg-mint-500/15 font-display text-sm font-bold text-mint-300">
                  {initials(club.name)}
                </span>
              )}
              <span className="font-display text-sm font-semibold leading-tight text-paper">{club.name}</span>
              <span className="text-[11px] text-smoke-500">{club.currentLeagueName}</span>
            </button>
            <Link
              to={`/leaderboard?mode=one-club&clubId=${club.id}&clubName=${encodeURIComponent(club.name)}`}
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
