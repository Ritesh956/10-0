import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type {
  EuropeRoundDto,
  KnockoutRound,
  KnockoutTieDto,
  MatchSummaryDto,
  SeasonDto,
  StandingsDto,
  SummaryDto,
  TeamStatsDto,
  WorldDto,
} from "../api/types";
import { KnockoutBracket } from "../components/KnockoutBracket";
import { MatchPopupReel } from "../components/MatchPopupReel";
import { ShareCard } from "../components/ShareCard";
import { StandingsTable } from "../components/StandingsTable";
import { TeamStatsPanel } from "../components/TeamStatsPanel";
import { Button } from "../components/ui/Button";
import { useDraft } from "../state/DraftContext";

type Phase =
  | "no-season"
  | "ready"
  | "simulating"
  | "domestic-replay"
  | "domestic-standings"
  | "team-stats"
  | "europe-transition"
  | "europe-league-replay"
  | "europe-league-standings"
  | "europe-knockout-replay"
  | "europe-round-result"
  | "europe-champion"
  | "summary";

const ROUND_LABEL: Record<KnockoutRound, string> = { QF: "Quarter-Final", SF: "Semi-Final", FINAL: "Final" };

async function pollUntilCompleted(worldId: string, seasonId: string): Promise<void> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const season = await api.getSeason(worldId, seasonId);
    if (season.status === "COMPLETED") return;
  }
}

export function SeasonPage() {
  const navigate = useNavigate();
  const { worldId } = useDraft();

  const [world, setWorld] = useState<WorldDto | null>(null);
  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [phase, setPhase] = useState<Phase>("no-season");
  const [domesticMatches, setDomesticMatches] = useState<MatchSummaryDto[]>([]);
  const [standings, setStandings] = useState<StandingsDto | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStatsDto | null>(null);
  const [summary, setSummary] = useState<SummaryDto | null>(null);

  const [qualified, setQualified] = useState(false);
  const [europeCompetitionId, setEuropeCompetitionId] = useState<string | null>(null);
  const [europeLeagueMatches, setEuropeLeagueMatches] = useState<MatchSummaryDto[]>([]);
  const [europeLeagueStandings, setEuropeLeagueStandings] = useState<StandingsDto | null>(null);
  const [knockoutRound, setKnockoutRound] = useState<KnockoutRound | null>(null);
  const [knockoutMatches, setKnockoutMatches] = useState<MatchSummaryDto[]>([]);
  const [resolvedTies, setResolvedTies] = useState<KnockoutTieDto[]>([]);
  const [champion, setChampion] = useState<string | null>(null);
  const [allTies, setAllTies] = useState<KnockoutTieDto[]>([]);

  // Lets an "announcement" phase auto-advance after a short pause, or resolve immediately if the
  // user clicks past it — same escape-hatch pattern as MatchPopupReel's "Skip ahead".
  const skipRef = useRef<(() => void) | null>(null);
  function pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      skipRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
  function skipPause() {
    skipRef.current?.();
  }

  const replayResolveRef = useRef<(() => void) | null>(null);
  function waitForReplay(): Promise<void> {
    return new Promise((resolve) => {
      replayResolveRef.current = resolve;
    });
  }

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
      // 20 clubs matches a real top-flight league size (and DraftPage's pre-season projection,
      // which assumes the same season size when it shows a finish position "out of 20").
      const created = await api.createSeason(worldId, "Fantasy Top Flight", 20);
      setSeason(created);
      const refreshed = await api.getWorld(worldId);
      setWorld(refreshed);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create season");
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulate() {
    if (!worldId || !season || !world) return;
    setError(null);
    try {
      await runSeasonPipeline(worldId, season.id, world);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    }
  }

  async function runSeasonPipeline(wId: string, domesticSeasonId: string, w: WorldDto) {
    const userClub = w.clubs.find((c) => c.managedByUserId);

    setPhase("simulating");
    await api.simulateSeason(wId, domesticSeasonId);
    await pollUntilCompleted(wId, domesticSeasonId);

    const [matches, standingsRes] = await Promise.all([
      api.getMatchesWithEvents(wId, domesticSeasonId),
      api.getStandings(wId, domesticSeasonId),
    ]);
    setDomesticMatches(matches);
    setStandings(standingsRes);
    setPhase("domestic-replay");
    await waitForReplay();

    setPhase("domestic-standings");
    await pause(4000);

    if (userClub) {
      const stats = await api.getTeamStats(wId, domesticSeasonId, userClub.id);
      setTeamStats(stats);
      setPhase("team-stats");
      await pause(4500);
    }

    const status = await api.getEuropeStatus(wId, domesticSeasonId);
    setQualified(status.qualified);

    if (!status.qualified) {
      const summaryRes = await api.getSummary(wId, domesticSeasonId);
      setSummary(summaryRes);
      setPhase("summary");
      return;
    }

    setPhase("europe-transition");
    await pause(3000);

    const { competitionId, seasonId: leaguePhaseSeasonId } = await api.startEuropeLeaguePhase(wId, domesticSeasonId);
    setEuropeCompetitionId(competitionId);
    await pollUntilCompleted(wId, leaguePhaseSeasonId);

    const [leagueMatches, leagueStandings] = await Promise.all([
      api.getMatchesWithEvents(wId, leaguePhaseSeasonId),
      api.getLeaguePhaseStandings(wId, leaguePhaseSeasonId),
    ]);
    setEuropeLeagueMatches(leagueMatches);
    setEuropeLeagueStandings(leagueStandings);
    setPhase("europe-league-replay");
    await waitForReplay();

    setPhase("europe-league-standings");
    await pause(4000);

    const qf = await api.startEuropeKnockouts(wId, competitionId, leaguePhaseSeasonId);
    await runKnockoutRound(wId, competitionId, qf);

    const summaryRes = await api.getSummary(wId, domesticSeasonId);
    setSummary(summaryRes);
    setPhase("summary");
  }

  async function runKnockoutRound(wId: string, competitionId: string, round: EuropeRoundDto) {
    setKnockoutRound(round.round);
    setAllTies((prev) => [...prev, ...round.ties]);
    await pollUntilCompleted(wId, round.seasonId);

    const matches = await api.getMatchesWithEvents(wId, round.seasonId);
    setKnockoutMatches(matches);
    setPhase("europe-knockout-replay");
    await waitForReplay();

    const result = await api.advanceEuropeKnockouts(wId, competitionId, round.round);
    setResolvedTies(result.resolvedTies);
    setAllTies((prev) => prev.map((t) => result.resolvedTies.find((r) => r.id === t.id) ?? t));
    setPhase("europe-round-result");
    await pause(3500);

    if (result.champion) {
      setChampion(result.champion);
      setPhase("europe-champion");
      await pause(3500);
      return;
    }

    if (result.next) {
      await runKnockoutRound(wId, competitionId, result.next);
    }
  }

  if (!world) {
    return <p className="px-6 py-16 text-center text-smoke-500">{error ?? "Loading..."}</p>;
  }

  const userClub = world.clubs.find((c) => c.managedByUserId);
  const nameFor = (clubId: string) => world.clubs.find((c) => c.id === clubId)?.name ?? clubId;

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
            {busy ? "Creating..." : "Create season"}
          </Button>
        </div>
      )}

      {season && phase === "ready" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-smoke-500">
            Season {season.year} &middot; {season.fixtures.length} fixtures
          </p>
          <Button size="lg" onClick={() => void handleSimulate()}>
            Simulate Season &rarr;
          </Button>
        </div>
      )}

      {phase === "simulating" && (
        <p className="text-center text-sm text-smoke-500">Kicking off the season&hellip;</p>
      )}

      {phase === "domestic-replay" && (
        <MatchPopupReel matches={domesticMatches} clubs={world.clubs} onComplete={() => replayResolveRef.current?.()} />
      )}

      {phase === "domestic-standings" && standings && (
        <div className="space-y-4">
          <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
            Final standings
          </h2>
          <StandingsTable standings={standings} clubs={world.clubs} highlightClubId={userClub?.id} />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={skipPause}>
              Continue &rarr;
            </Button>
          </div>
        </div>
      )}

      {phase === "team-stats" && teamStats && (
        <div className="space-y-4">
          <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
            {userClub?.name}&apos;s season
          </h2>
          <TeamStatsPanel stats={teamStats} />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={skipPause}>
              Continue &rarr;
            </Button>
          </div>
        </div>
      )}

      {phase === "europe-transition" && (
        <div className="notch space-y-3 border-2 border-gold-400/60 bg-gradient-to-br from-gold-500/15 via-ink-900 to-ink-950 p-8 text-center">
          <p className="text-3xl">&#127942;</p>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">
            Congratulations! {userClub?.name} qualified for the Champions League
          </h2>
          <p className="text-sm text-smoke-400">Continuing into the European campaign&hellip;</p>
          <Button variant="ghost" size="sm" onClick={skipPause}>
            Continue &rarr;
          </Button>
        </div>
      )}

      {phase === "europe-league-replay" && (
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
            Champions League &middot; League Phase
          </p>
          <MatchPopupReel
            matches={europeLeagueMatches}
            clubs={world.clubs}
            onComplete={() => replayResolveRef.current?.()}
          />
        </div>
      )}

      {phase === "europe-league-standings" && europeLeagueStandings && (
        <div className="space-y-4">
          <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
            Champions League &middot; League Phase Standings
          </h2>
          <StandingsTable standings={europeLeagueStandings} clubs={world.clubs} highlightClubId={userClub?.id} />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={skipPause}>
              Continue to Knockouts &rarr;
            </Button>
          </div>
        </div>
      )}

      {phase === "europe-knockout-replay" && knockoutRound && (
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
            Champions League &middot; {ROUND_LABEL[knockoutRound]}
          </p>
          <MatchPopupReel matches={knockoutMatches} clubs={world.clubs} onComplete={() => replayResolveRef.current?.()} />
        </div>
      )}

      {phase === "europe-round-result" && knockoutRound && (
        <div className="space-y-4 text-center">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">
            {ROUND_LABEL[knockoutRound]} results
          </h2>
          <KnockoutBracket ties={resolvedTies} clubs={world.clubs} highlightClubId={userClub?.id} />
          <Button variant="ghost" size="sm" onClick={skipPause}>
            Continue &rarr;
          </Button>
        </div>
      )}

      {phase === "europe-champion" && champion && (
        <div className="notch space-y-3 border-2 border-gold-400/70 bg-gradient-to-br from-gold-500/20 via-ink-900 to-ink-950 p-8 text-center">
          <p className="text-3xl">&#127942;</p>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">Champions League Winners</p>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-paper">{nameFor(champion)}</h2>
          {allTies.length > 0 && <KnockoutBracket ties={allTies} clubs={world.clubs} highlightClubId={userClub?.id} />}
          <Button variant="ghost" size="sm" onClick={skipPause}>
            Continue &rarr;
          </Button>
        </div>
      )}

      {phase === "summary" && summary && (
        <div className="mx-auto max-w-md space-y-4">
          {qualified && champion && (
            <p className="text-center text-sm text-gold-400">
              {champion === userClub?.id
                ? "European champions this season — the treble of storylines complete!"
                : `${nameFor(champion)} lifted the Champions League this season.`}
            </p>
          )}
          <ShareCard summary={summary} />
        </div>
      )}
    </div>
  );
}
