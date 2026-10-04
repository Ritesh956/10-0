import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { RealClubDto } from "../api/types";
import { initials } from "../lib/positionColors";
import { clubDisplayName } from "../lib/clubNames";
import { CountryFlag } from "../components/CountryFlag";
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
  const [leagueTab, setLeagueTab] = useState<string>("all");

  useEffect(() => {
    void api
      .listClubs()
      .then(setClubs)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load clubs"));
  }, []);

  const leagueTabs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of clubs ?? []) if (!seen.has(c.currentLeagueName)) seen.set(c.currentLeagueName, c.country);
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [clubs]);

  const filtered = useMemo(() => {
    if (!clubs) return null;
    const q = search.trim().toLowerCase();
    return clubs
      .filter((c) => leagueTab === "all" || c.currentLeagueName === leagueTab)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || clubDisplayName(c.name).toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .sort((a, b) => clubDisplayName(a.name).localeCompare(clubDisplayName(b.name)));
  }, [clubs, search, leagueTab]);

  function pickClub(club: RealClubDto) {
    resetDraft();
    setConfig({
      eraId: "era-all-time",
      leagueIds: [club.currentLeagueId],
      lockedClubId: club.id,
      lockedClubName: clubDisplayName(club.name),
      lockedNationality: undefined,
      playerRatings: "season",
      eraYearMin: undefined,
      eraYearMax: undefined,
    });
    // Only fill in a default name if the user hasn't already typed one this session — matches
    // DraftPage's own "untouched squadName defaults, doesn't clobber" convention.
    if (!squadName) setSquadName(`${clubDisplayName(club.name)} All-Time XI`);
    navigate("/setup");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">One-Club XI</h1>
        <p className="mt-2 text-sm text-smoke-500">
          Pick a real club and draft your all-time greatest XI from their entire history — any era, any season.
        </p>
        <p className="mt-1 text-xs text-smoke-500">
          Beat the club&apos;s best simulated record for <span className="text-amber-300">Club Record Breaker</span>; set its worst for{" "}
          <span className="text-crimson-300">Club Worst Ever</span>.
        </p>
      </div>

      {leagueTabs.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="League">
          {[["all", ""] as [string, string], ...leagueTabs].map(([name, country]) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={leagueTab === name}
              onClick={() => setLeagueTab(name)}
              className={`notch-sm border px-3 py-1.5 text-xs font-semibold transition ${
                leagueTab === name ? "border-mint-500 bg-mint-500/10 text-mint-300" : "border-ink-700 text-smoke-400 hover:text-paper"
              }`}
            >
              {name === "all" ? (
                "All leagues"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <CountryFlag country={country} />
                  {name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

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
                  {initials(clubDisplayName(club.name))}
                </span>
              )}
              <span className="font-display text-sm font-semibold leading-tight text-paper" title={club.name}>
                {clubDisplayName(club.name)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-smoke-500">
                <CountryFlag country={club.country} className="h-2.5 w-[15px]" /> {club.currentLeagueName}
              </span>
            </button>
            <Link
              to={`/leaderboard?mode=one-club&clubId=${club.id}&clubName=${encodeURIComponent(clubDisplayName(club.name))}`}
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
