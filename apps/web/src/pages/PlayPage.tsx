import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  ClubSeasonDto,
  EraDto,
  LeagueDto,
  PlayerSeasonDto,
  SeasonDto,
  StandingsDto,
  SummaryDto,
  WorldDto,
} from "../api/types";
import { StandingsTable } from "../components/StandingsTable";
import { ShareCard } from "../components/ShareCard";

const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "4-5-1",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
  "4-4-1-1",
  "3-4-2-1",
];

type Mode = "club" | "roll" | "draft" | null;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

export function PlayPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [worlds, setWorlds] = useState<WorldDto[] | null>(null);
  const [activeWorld, setActiveWorld] = useState<WorldDto | null>(null);

  const [eras, setEras] = useState<EraDto[]>([]);
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [selectedEraId, setSelectedEraId] = useState<string>("");
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);

  const [mode, setMode] = useState<Mode>(null);
  const [clubSeasons, setClubSeasons] = useState<ClubSeasonDto[]>([]);
  const [rolledClub, setRolledClub] = useState<ClubSeasonDto | null>(null);
  const [playerPool, setPlayerPool] = useState<PlayerSeasonDto[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [fantasyClubName, setFantasyClubName] = useState("My Fantasy XI");
  const [formation, setFormation] = useState("4-4-2");

  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [standings, setStandings] = useState<StandingsDto | null>(null);
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [simulating, setSimulating] = useState(false);

  const runAsync = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }, []);

  // Initial load: worlds + eras
  useEffect(() => {
    void runAsync(async () => {
      const [worldList, eraList] = await Promise.all([api.listWorlds(), api.listEras()]);
      setWorlds(worldList);
      setEras(eraList);
      const existing = worldList.find((w) => w.clubs.length === 0) ?? worldList[0] ?? null;
      if (existing) {
        setActiveWorld(existing);
        setSelectedEraId(existing.eraId);
      }
    });
  }, [runAsync]);

  // Load leagues when era changes
  useEffect(() => {
    if (!selectedEraId) return;
    void runAsync(async () => {
      const leagueList = await api.listLeagues(selectedEraId);
      setLeagues(leagueList);
    });
  }, [selectedEraId, runAsync]);

  async function handleCreateWorld() {
    await runAsync(async () => {
      const world = await api.createWorld(selectedEraId);
      setActiveWorld(world);
      setWorlds((prev) => [...(prev ?? []), world]);
    });
  }

  async function handleBrowseClubSeasons() {
    await runAsync(async () => {
      const seasons = await api.listClubSeasons({ eraId: selectedEraId, leagueIds: selectedLeagueIds });
      setClubSeasons(seasons);
      setMode("club");
    });
  }

  async function handleRoll() {
    await runAsync(async () => {
      const club = await api.rollClubSeason({ eraId: selectedEraId, leagueIds: selectedLeagueIds });
      setRolledClub(club);
      setMode("roll");
    });
  }

  async function handleOpenDraft(randomize: boolean) {
    await runAsync(async () => {
      let pool = await api.listPlayerSeasons({ eraId: selectedEraId, leagueIds: selectedLeagueIds });
      if (randomize) pool = shuffle(pool).slice(0, 40);
      else pool = pool.slice(0, 40);
      setPlayerPool(pool);
      setSelectedPlayerIds(new Set());
      setMode("draft");
    });
  }

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 23) next.add(id);
      return next;
    });
  }

  async function handleDraftClub(refClubSeasonId: string) {
    if (!activeWorld) return;
    await runAsync(async () => {
      await api.draftClub(activeWorld.id, refClubSeasonId, formation);
      const world = await api.getWorld(activeWorld.id);
      setActiveWorld(world);
      setMode(null);
    });
  }

  async function handleDraftFantasy() {
    if (!activeWorld) return;
    await runAsync(async () => {
      await api.draftFantasy(activeWorld.id, fantasyClubName, formation, [...selectedPlayerIds]);
      const world = await api.getWorld(activeWorld.id);
      setActiveWorld(world);
      setMode(null);
    });
  }

  async function handleCreateSeason() {
    if (!activeWorld) return;
    await runAsync(async () => {
      const created = await api.createSeason(activeWorld.id, "Sample Top Flight", 8);
      setSeason(created);
      // refresh world so it includes the AI clubs generated to fill the league
      const world = await api.getWorld(activeWorld.id);
      setActiveWorld(world);
    });
  }

  async function handleSimulate() {
    if (!activeWorld || !season) return;
    setError(null);
    setSimulating(true);
    try {
      await api.simulateSeason(activeWorld.id, season.id);
      // poll until the season is marked complete
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const updated = await api.getSeason(activeWorld.id, season.id);
        setSeason(updated);
        if (updated.status === "COMPLETED") break;
      }
      const [standingsRes, summaryRes] = await Promise.all([
        api.getStandings(activeWorld.id, season.id),
        api.getSummary(activeWorld.id, season.id),
      ]);
      setStandings(standingsRes);
      setSummary(summaryRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  if (worlds === null) {
    return <p className="text-slate-400">Loading...</p>;
  }

  // ---- Step 1: no world yet -> pick an era to start a save ----
  if (!activeWorld) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Choose an era</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {eras.map((era) => (
            <button
              key={era.id}
              onClick={() => setSelectedEraId(era.id)}
              className={`rounded-lg border p-4 text-left transition ${
                selectedEraId === era.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-600"
              }`}
            >
              <div className="font-semibold text-white">{era.name}</div>
              <div className="text-xs text-slate-500">
                {era.startYear}–{era.endYear}
              </div>
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          disabled={!selectedEraId || busy}
          onClick={() => void handleCreateWorld()}
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
        >
          Start save
        </button>
      </section>
    );
  }

  // ---- Step 2: world has no club yet -> draft one ----
  if (activeWorld.clubs.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Build your squad</h1>

        <div className="flex flex-wrap gap-2">
          {leagues.map((league) => {
            const active = selectedLeagueIds.includes(league.id);
            return (
              <button
                key={league.id}
                onClick={() =>
                  setSelectedLeagueIds((prev) =>
                    active ? prev.filter((id) => id !== league.id) : [...prev, league.id],
                  )
                }
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {league.name}
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Formation</label>
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleBrowseClubSeasons()}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium hover:border-slate-500"
          >
            Pick a club
          </button>
          <button
            onClick={() => void handleRoll()}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium hover:border-slate-500"
          >
            🎲 Roll
          </button>
          <button
            onClick={() => void handleOpenDraft(false)}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium hover:border-slate-500"
          >
            Fantasy draft
          </button>
          <button
            onClick={() => void handleOpenDraft(true)}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium hover:border-slate-500"
          >
            Random draft
          </button>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        {mode === "club" && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Club seasons</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {clubSeasons.map((cs) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-4 py-3"
                >
                  <div>
                    <div className="font-medium">
                      {cs.club.name} <span className="text-slate-500">{cs.seasonYear}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {cs.league.name} &middot; Reputation {cs.reputation}
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void handleDraftClub(cs.id)}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                  >
                    Draft
                  </button>
                </div>
              ))}
              {clubSeasons.length === 0 && <p className="text-sm text-slate-500">No club seasons match those filters.</p>}
            </div>
          </div>
        )}

        {mode === "roll" && rolledClub && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
            <p className="text-xs uppercase tracking-wide text-amber-400">Roll result</p>
            <p className="mt-1 text-xl font-bold">
              {rolledClub.club.name} {rolledClub.seasonYear}
            </p>
            <p className="text-sm text-slate-400">
              {rolledClub.league.name} &middot; Reputation {rolledClub.reputation}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => void handleRoll()}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
              >
                Reroll
              </button>
              <button
                disabled={busy}
                onClick={() => void handleDraftClub(rolledClub.id)}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
              >
                Confirm draft
              </button>
            </div>
          </div>
        )}

        {mode === "draft" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-wide text-slate-500">Club name</label>
              <input
                value={fantasyClubName}
                onChange={(e) => setFantasyClubName(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-500">{selectedPlayerIds.size}/23 selected (need 11+)</span>
            </div>
            <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
              {playerPool.map((ps) => {
                const selected = selectedPlayerIds.has(ps.id);
                return (
                  <button
                    key={ps.id}
                    onClick={() => togglePlayer(ps.id)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                      selected ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <span>
                      {ps.player.name}{" "}
                      <span className="text-xs text-slate-500">
                        {ps.positions.join("/")} &middot; {ps.clubSeason.club.name} {ps.seasonYear}
                      </span>
                    </span>
                    <span className="font-bold text-emerald-400">{ps.overall}</span>
                  </button>
                );
              })}
            </div>
            <button
              disabled={busy || selectedPlayerIds.size < 11}
              onClick={() => void handleDraftFantasy()}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              Confirm squad
            </button>
          </div>
        )}
      </section>
    );
  }

  const userClub = activeWorld.clubs.find((c) => c.managedByUserId);

  // ---- Step 3: season + simulate + standings + share ----
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-white">
        {userClub?.name} <span className="text-slate-500">&middot; {activeWorld.clubs.length} clubs in save</span>
      </h1>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!season && (
        <button
          disabled={busy}
          onClick={() => void handleCreateSeason()}
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          Create 8-club season
        </button>
      )}

      {season && !summary && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Season {season.year} &middot; {season.fixtures.length} fixtures &middot; status:{" "}
            <span className="font-semibold text-white">{season.status}</span>
          </p>
          <button
            disabled={simulating || season.status === "COMPLETED"}
            onClick={() => void handleSimulate()}
            className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            {simulating ? "Simulating season..." : "Simulate full season"}
          </button>
        </div>
      )}

      {standings && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Final standings</h2>
          <StandingsTable standings={standings} clubs={activeWorld.clubs} highlightClubId={userClub?.id} />
        </div>
      )}

      {summary && (
        <div className="mx-auto max-w-md">
          <ShareCard summary={summary} />
        </div>
      )}
    </section>
  );
}
