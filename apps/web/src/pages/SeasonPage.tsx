import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type {
  CompetitionStatsDto,
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
import { CompetitionStatsPanel } from "../components/CompetitionStatsPanel";
import { KnockoutBracket } from "../components/KnockoutBracket";
import { MatchPopupReel } from "../components/MatchPopupReel";
import { ShareCard } from "../components/ShareCard";
import { StandingsTable } from "../components/StandingsTable";
import { TeamStatsPanel } from "../components/TeamStatsPanel";
import { Button } from "../components/ui/Button";
import { fireChampionShower, fireQualificationBurst } from "../lib/confetti";
import { staggerContainer, staggerItem, staggerItemBounce } from "../lib/motion";
import { useDraft } from "../state/DraftContext";

type Phase =
  | "no-season"
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
  | "stats-hub";

type StatsTab = "league" | "europe";

const ROUND_LABEL: Record<KnockoutRound, string> = { QF: "Quarter-Final", SF: "Semi-Final", FINAL: "Final" };

async function pollUntilCompleted(worldId: string, seasonId: string): Promise<void> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const season = await api.getSeason(worldId, seasonId);
    if (season.status === "COMPLETED") return;
  }
}

interface CachedStatsHub {
  standings: StandingsDto;
  teamStats: TeamStatsDto | null;
  leagueCompetitionStats: CompetitionStatsDto | null;
  qualified: boolean;
  europeLeagueStandings: StandingsDto | null;
  europeCompetitionStats: CompetitionStatsDto | null;
  europeTeamStats: TeamStatsDto | null;
  allTies: KnockoutTieDto[];
  champion: string | null;
  summary: SummaryDto;
}

// A finished run's standings/stats are cached per-world so leaving /season and coming back (or
// just reloading) lands straight back on the stats hub instead of re-running the whole animated
// pipeline for data that hasn't changed — "easy to navigate anytime unless you start a new run"
// falls out naturally, since a new draft always gets a new worldId and finds no cache entry.
function statsHubCacheKey(worldId: string): string {
  return `futbol_stats_hub_${worldId}`;
}
function saveStatsHubCache(worldId: string, data: CachedStatsHub): void {
  try {
    localStorage.setItem(statsHubCacheKey(worldId), JSON.stringify(data));
  } catch {
    // Storage full or unavailable — not worth failing the season over, the user just won't get
    // the fast-path back to this screen next time.
  }
}
function loadStatsHubCache(worldId: string): CachedStatsHub | null {
  const raw = localStorage.getItem(statsHubCacheKey(worldId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedStatsHub;
  } catch {
    return null;
  }
}

export function SeasonPage() {
  const navigate = useNavigate();
  const { worldId, config } = useDraft();

  const [world, setWorld] = useState<WorldDto | null>(null);
  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [phase, setPhase] = useState<Phase>("no-season");
  const [simulatingLabel, setSimulatingLabel] = useState("Kicking off the season…");
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

  // Final stats hub: league and (if qualified) Champions League stats live side by side behind a
  // tab toggle instead of a one-shot "summary" screen, so the user can freely flip between them
  // afterward rather than only ever seeing whichever one the linear pipeline ended on.
  const [statsTab, setStatsTab] = useState<StatsTab>("league");
  const [leagueCompetitionStats, setLeagueCompetitionStats] = useState<CompetitionStatsDto | null>(null);
  const [europeCompetitionStats, setEuropeCompetitionStats] = useState<CompetitionStatsDto | null>(null);
  const [europeTeamStats, setEuropeTeamStats] = useState<TeamStatsDto | null>(null);

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
    void api
      .getWorld(worldId)
      .then((w) => {
        setWorld(w);
        const cached = loadStatsHubCache(worldId);
        if (!cached) return;
        setStandings(cached.standings);
        setTeamStats(cached.teamStats);
        setLeagueCompetitionStats(cached.leagueCompetitionStats);
        setQualified(cached.qualified);
        setEuropeLeagueStandings(cached.europeLeagueStandings);
        setEuropeCompetitionStats(cached.europeCompetitionStats);
        setEuropeTeamStats(cached.europeTeamStats);
        setAllTies(cached.allTies);
        setChampion(cached.champion);
        setSummary(cached.summary);
        setStatsTab(cached.qualified ? "europe" : "league");
        setPhase("stats-hub");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load world"));
  }, [worldId, navigate]);

  useEffect(() => {
    if (phase === "europe-transition") fireQualificationBurst();
  }, [phase]);

  useEffect(() => {
    if (phase !== "europe-champion" || !champion || !world) return;
    const userClubId = world.clubs.find((c) => c.managedByUserId)?.id;
    if (champion === userClubId) fireChampionShower();
  }, [phase, champion, world]);

  // One click does both create-season and simulate — there's no real reason to make the user
  // press twice for what's really a single "start my season" action, and it used to leave a
  // confusing beat where the page still said "1 clubs in this save" (the pre-AI-fill count)
  // while the button read "Creating...".
  async function handleStartSeason() {
    if (!worldId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createSeason(worldId, "Fantasy Top Flight", { leagueId: config.leagueIds[0] });
      setSeason(created);
      const refreshed = await api.getWorld(worldId);
      setWorld(refreshed);
      await runSeasonPipeline(worldId, created, refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start season");
      setBusy(false);
    }
  }

  async function runSeasonPipeline(wId: string, domesticSeason: SeasonDto, w: WorldDto) {
    const userClub = w.clubs.find((c) => c.managedByUserId);
    const domesticSeasonId = domesticSeason.id;

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

    let domesticTeamStats: TeamStatsDto | null = null;
    if (userClub) {
      domesticTeamStats = await api.getTeamStats(wId, domesticSeasonId, userClub.id);
      setTeamStats(domesticTeamStats);
      setPhase("team-stats");
      await pause(4500);
    }

    const leagueStats = await api.getCompetitionStats(wId, domesticSeason.competitionId);
    setLeagueCompetitionStats(leagueStats);

    const status = await api.getEuropeStatus(wId, domesticSeasonId);
    setQualified(status.qualified);

    if (!status.qualified) {
      const summaryRes = await api.getSummary(wId, domesticSeasonId);
      setSummary(summaryRes);
      setStatsTab("league");
      setPhase("stats-hub");
      saveStatsHubCache(wId, {
        standings: standingsRes,
        teamStats: domesticTeamStats,
        leagueCompetitionStats: leagueStats,
        qualified: false,
        europeLeagueStandings: null,
        europeCompetitionStats: null,
        europeTeamStats: null,
        allTies: [],
        champion: null,
        summary: summaryRes,
      });
      return;
    }

    setPhase("europe-transition");
    await pause(3000);

    // Clicking past a pause immediately kicks off a real backend call + polling wait with no
    // MatchPopupReel/animation to fill the gap — without an explicit loading phase here, the
    // screen just sits on the same stale content with the same "Continue" button still showing,
    // which reads as "Continue did nothing" even though the pipeline is actually progressing.
    setPhase("simulating");
    setSimulatingLabel("Kicking off the Champions League…");
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

    // This is the one deliberate, required checkpoint in the whole knockout stage — everything
    // from here (QF -> SF -> Final -> champion) plays straight through with no further "Continue"
    // clicks needed, only brief auto-advancing pauses (see runKnockoutRound).
    setPhase("simulating");
    setSimulatingLabel("Setting up the knockouts…");
    const qf = await api.startEuropeKnockouts(wId, competitionId, leaguePhaseSeasonId);
    const { champion: finalChampion, ties: finalTies } = await runKnockoutRound(wId, competitionId, qf);

    const [summaryRes, europeStats, europeTeam] = await Promise.all([
      api.getSummary(wId, domesticSeasonId),
      api.getCompetitionStats(wId, competitionId),
      userClub ? api.getTeamStatsForCompetition(wId, competitionId, userClub.id) : Promise.resolve(null),
    ]);
    setSummary(summaryRes);
    setEuropeCompetitionStats(europeStats);
    setEuropeTeamStats(europeTeam);
    setStatsTab("europe");
    setPhase("stats-hub");
    saveStatsHubCache(wId, {
      standings: standingsRes,
      teamStats: domesticTeamStats,
      leagueCompetitionStats: leagueStats,
      qualified: true,
      europeLeagueStandings: leagueStandings,
      europeCompetitionStats: europeStats,
      europeTeamStats: europeTeam,
      allTies: finalTies,
      champion: finalChampion,
      summary: summaryRes,
    });
  }

  // Returns the eventual champion + full tie history via its return value rather than solely
  // through state setters — this function keeps recursing across many awaited async steps, and a
  // long-lived closure like that can end up reading stale `champion`/`allTies` state (captured at
  // the render where `runSeasonPipeline` was first invoked) if the caller reached for those
  // instead. Needed reliably at the end for the stats-hub cache (see saveStatsHubCache below).
  async function runKnockoutRound(
    wId: string,
    competitionId: string,
    round: EuropeRoundDto,
    tiesSoFar: KnockoutTieDto[] = [],
  ): Promise<{ champion: string; ties: KnockoutTieDto[] }> {
    setKnockoutRound(round.round);
    // Same reasoning as the league-phase transition above — this covers both the first entry
    // into the knockout stage and every recursive SF/FINAL call, so no round-to-round transition
    // is ever left showing the previous round's stale result screen during the polling wait.
    setPhase("simulating");
    setSimulatingLabel(`Simulating the ${ROUND_LABEL[round.round]}…`);
    const ties = [...tiesSoFar, ...round.ties];
    setAllTies(ties);
    await pollUntilCompleted(wId, round.seasonId);

    const matches = await api.getMatchesWithEvents(wId, round.seasonId);
    setKnockoutMatches(matches);
    setPhase("europe-knockout-replay");
    await waitForReplay();

    const result = await api.advanceEuropeKnockouts(wId, competitionId, round.round);
    setResolvedTies(result.resolvedTies);
    const resolvedTies = ties.map((t) => result.resolvedTies.find((r) => r.id === t.id) ?? t);
    setAllTies(resolvedTies);
    // No "Continue" button on this screen (or the champion one below) — round-to-round progress
    // through the knockouts is fully automatic once the user has clicked past the league-phase
    // standings, so a best-of-four run only ever needs that one earlier press.
    setPhase("europe-round-result");
    await pause(2200);

    if (result.champion) {
      setChampion(result.champion);
      setPhase("europe-champion");
      await pause(3200);
      return { champion: result.champion, ties: resolvedTies };
    }

    if (result.next) {
      return runKnockoutRound(wId, competitionId, result.next, resolvedTies);
    }

    throw new Error("Knockout stage ended without a champion");
  }

  if (!world) {
    return <p className="px-6 py-16 text-center text-smoke-500">{error ?? "Loading..."}</p>;
  }

  const userClub = world.clubs.find((c) => c.managedByUserId);
  const nameFor = (clubId: string) => world.clubs.find((c) => c.id === clubId)?.name ?? clubId;
  // Replays only ever show the user's own fixtures — nobody wants to sit through all 380 league
  // matches (or every other tie in a knockout round) just to see their own team's results roll in.
  const onlyMine = (list: MatchSummaryDto[]) =>
    userClub ? list.filter((m) => m.homeClubId === userClub.id || m.awayClubId === userClub.id) : list;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">{userClub?.name ?? "Your XI"}</h1>
        <p className="mt-1 text-sm text-smoke-500">{world.clubs.length} clubs in this save</p>
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      {phase === "no-season" && (
        <div className="text-center">
          <Button size="lg" disabled={busy} onClick={() => void handleStartSeason()}>
            {busy ? "Starting..." : "Simulate Season →"}
          </Button>
        </div>
      )}

      {phase === "simulating" && (
        <p className="animate-gold-pulse text-center text-sm text-smoke-500">{simulatingLabel}</p>
      )}

      {phase === "domestic-replay" && (
        <MatchPopupReel matches={onlyMine(domesticMatches)} clubs={world.clubs} onComplete={() => replayResolveRef.current?.()} />
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
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="notch space-y-3 border-2 border-gold-400/60 bg-gradient-to-br from-gold-500/15 via-ink-900 to-ink-950 p-8 text-center"
        >
          <motion.p variants={staggerItemBounce} className="text-3xl">
            &#127942;
          </motion.p>
          <motion.h2 variants={staggerItem} className="font-display text-2xl font-bold uppercase tracking-wide text-paper">
            Congratulations! {userClub?.name} qualified for the Champions League
          </motion.h2>
          <motion.p variants={staggerItem} className="text-sm text-smoke-400">
            Continuing into the European campaign&hellip;
          </motion.p>
          <motion.div variants={staggerItem}>
            <Button variant="ghost" size="sm" onClick={skipPause}>
              Continue &rarr;
            </Button>
          </motion.div>
        </motion.div>
      )}

      {phase === "europe-league-replay" && (
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
            Champions League &middot; League Phase
          </p>
          <MatchPopupReel
            matches={onlyMine(europeLeagueMatches)}
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
          <MatchPopupReel matches={onlyMine(knockoutMatches)} clubs={world.clubs} onComplete={() => replayResolveRef.current?.()} />
        </div>
      )}

      {phase === "europe-round-result" && knockoutRound && (
        <div className="space-y-4 text-center">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">
            {ROUND_LABEL[knockoutRound]} results
          </h2>
          <KnockoutBracket ties={resolvedTies} clubs={world.clubs} highlightClubId={userClub?.id} />
        </div>
      )}

      {phase === "europe-champion" && champion && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="notch space-y-3 border-2 border-gold-400/70 bg-gradient-to-br from-gold-500/20 via-ink-900 to-ink-950 p-8 text-center"
        >
          <motion.p variants={staggerItemBounce} className="text-3xl">
            &#127942;
          </motion.p>
          <motion.p variants={staggerItem} className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">
            Champions League Winners
          </motion.p>
          <motion.h2 variants={staggerItem} className="font-display text-3xl font-bold uppercase tracking-tight text-paper">
            {nameFor(champion)}
          </motion.h2>
          {allTies.length > 0 && (
            <motion.div variants={staggerItem}>
              <KnockoutBracket ties={allTies} clubs={world.clubs} highlightClubId={userClub?.id} />
            </motion.div>
          )}
        </motion.div>
      )}

      {phase === "stats-hub" && summary && (
        <div className="mx-auto max-w-2xl space-y-6">
          {qualified && champion && (
            <p className="text-center text-sm text-gold-400">
              {champion === userClub?.id
                ? "European champions this season — the treble of storylines complete!"
                : `${nameFor(champion)} lifted the Champions League this season.`}
            </p>
          )}
          <ShareCard summary={summary} />

          {qualified && (
            <div className="flex justify-center gap-2">
              <Button variant={statsTab === "europe" ? "primary" : "outline"} size="sm" onClick={() => setStatsTab("europe")}>
                Champions League
              </Button>
              <Button variant={statsTab === "league" ? "primary" : "outline"} size="sm" onClick={() => setStatsTab("league")}>
                League
              </Button>
            </div>
          )}

          {statsTab === "league" && standings && (
            <div className="space-y-4">
              <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
                League &middot; Final Standings
              </h2>
              <StandingsTable standings={standings} clubs={world.clubs} highlightClubId={userClub?.id} />
              {leagueCompetitionStats && (
                <CompetitionStatsPanel stats={leagueCompetitionStats} highlightClubId={userClub?.id} />
              )}
              {teamStats && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    {userClub?.name}&apos;s league season
                  </h3>
                  <TeamStatsPanel stats={teamStats} />
                </>
              )}
            </div>
          )}

          {statsTab === "europe" && qualified && (
            <div className="space-y-4">
              <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
                Champions League
              </h2>
              {allTies.length > 0 && <KnockoutBracket ties={allTies} clubs={world.clubs} highlightClubId={userClub?.id} />}
              {europeLeagueStandings && (
                <StandingsTable standings={europeLeagueStandings} clubs={world.clubs} highlightClubId={userClub?.id} />
              )}
              {europeCompetitionStats && (
                <CompetitionStatsPanel stats={europeCompetitionStats} highlightClubId={userClub?.id} />
              )}
              {europeTeamStats && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    {userClub?.name}&apos;s Champions League run
                  </h3>
                  <TeamStatsPanel stats={europeTeamStats} />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
