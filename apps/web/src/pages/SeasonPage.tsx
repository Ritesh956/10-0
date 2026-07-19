import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { SeasonDto, StandingsDto, SummaryDto, WorldDto } from "../api/types";
import { ShareCard } from "../components/ShareCard";
import { StandingsTable } from "../components/StandingsTable";
import { Button } from "../components/ui/Button";
import { useDraft } from "../state/DraftContext";

export function SeasonPage() {
  const navigate = useNavigate();
  const { worldId } = useDraft();

  const [world, setWorld] = useState<WorldDto | null>(null);
  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [standings, setStandings] = useState<StandingsDto | null>(null);
  const [summary, setSummary] = useState<SummaryDto | null>(null);

  const [busy, setBusy] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!worldId) {
      navigate("/setup");
      return;
    }
    void api.getWorld(worldId).then(setWorld).catch((err) => setError(err instanceof Error ? err.message : "Failed to load world"));
  }, [worldId, navigate]);

  async function handleCreateSeason() {
    if (!worldId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createSeason(worldId, "Fantasy Top Flight", 8);
      setSeason(created);
      const refreshed = await api.getWorld(worldId);
      setWorld(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create season");
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulate() {
    if (!worldId || !season) return;
    setError(null);
    setSimulating(true);
    try {
      await api.simulateSeason(worldId, season.id);
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const updated = await api.getSeason(worldId, season.id);
        setSeason(updated);
        if (updated.status === "COMPLETED") break;
      }
      const [standingsRes, summaryRes] = await Promise.all([
        api.getStandings(worldId, season.id),
        api.getSummary(worldId, season.id),
      ]);
      setStandings(standingsRes);
      setSummary(summaryRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  if (!world) {
    return <p className="px-6 py-16 text-center text-smoke-500">{error ?? "Loading..."}</p>;
  }

  const userClub = world.clubs.find((c) => c.managedByUserId);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">{userClub?.name ?? "Your XI"}</h1>
        <p className="mt-1 text-sm text-smoke-500">{world.clubs.length} clubs in this save</p>
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      {!season && (
        <div className="text-center">
          <Button size="lg" disabled={busy} onClick={() => void handleCreateSeason()}>
            {busy ? "Creating..." : "Create 8-club season"}
          </Button>
        </div>
      )}

      {season && !summary && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-smoke-500">
            Season {season.year} &middot; {season.fixtures.length} fixtures &middot; status:{" "}
            <span className="font-semibold text-paper">{season.status}</span>
          </p>
          <Button size="lg" disabled={simulating || season.status === "COMPLETED"} onClick={() => void handleSimulate()}>
            {simulating ? "Simulating season..." : "Simulate full season"}
          </Button>
        </div>
      )}

      {standings && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Final standings</h2>
          <StandingsTable standings={standings} clubs={world.clubs} highlightClubId={userClub?.id} />
        </div>
      )}

      {summary && (
        <div className="mx-auto max-w-md">
          <ShareCard summary={summary} />
        </div>
      )}
    </div>
  );
}
