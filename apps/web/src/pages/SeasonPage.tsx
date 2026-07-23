import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type {
  CompetitionStatsDto,
  EuropeRoundDto,
  EuropeStatusDto,
  JanuaryResultDto,
  KnockoutRound,
  KnockoutTieDto,
  ManagerStatsDto,
  MatchSummaryDto,
  SeasonDto,
  StandingsDto,
  SummaryDto,
  TeamStatsDto,
  TrophyKey,
  WorldDto,
} from "../api/types";
import { CompetitionStatsPanel } from "../components/CompetitionStatsPanel";
import { GuestPersistPrompt } from "../components/GuestPersistPrompt";
import { JanuaryShareCard } from "../components/JanuaryShareCard";
import { JanuaryWindow } from "../components/JanuaryWindow";
import { KnockoutBracket } from "../components/KnockoutBracket";
import { LeaderboardSubmitBlock } from "../components/LeaderboardSubmitBlock";
import { ManagerStatCard } from "../components/ManagerStatCard";
import { MatchLog } from "../components/MatchLog";
import { MatchPopupReel } from "../components/MatchPopupReel";
import { SeasonNarrative } from "../components/SeasonNarrative";
import { ShareCard } from "../components/ShareCard";
import { StandingsTable } from "../components/StandingsTable";
import { TeamStatsPanel } from "../components/TeamStatsPanel";
import { TrophyCabinet } from "../components/TrophyCabinet";
import { Button } from "../components/ui/Button";
import { fireChampionShower, fireQualificationBurst } from "../lib/confetti";
import { staggerContainer, staggerItem, staggerItemBounce } from "../lib/motion";
import { buildSeasonNarrative } from "../lib/seasonNarrative";
import { squadTierName, TIER_TEXT } from "../lib/squadRatings";
import { useDraft } from "../state/DraftContext";

type Phase =
  | "no-season"
  | "simulating"
  | "domestic-replay"
  | "january"
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
    // Check before sleeping: after the streaming reveal the season is usually already COMPLETED, so
    // this returns on the first call with no needless 1.2s pause (only a skip-ahead leaves real work).
    const season = await api.getSeason(worldId, seasonId);
    if (season.status === "COMPLETED") return;
    await new Promise((resolve) => setTimeout(resolve, 1200));
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
  /** Optional for backward compat with cache entries saved before the persistent match log existed. */
  domesticMatches?: MatchSummaryDto[];
  europeMatches?: MatchSummaryDto[];
  /** null = January was off, or the user declined the gamble. Optional for backward compat with
      cache entries saved before the January Transfer Window existed. Feeds the season narrative's
      January recap lines and the two-way "Share your January" card. */
  januaryOutcome?: JanuaryResultDto | null;
  /** Domestic-only (38-0's own manager stat card has no per-competition split) — null for a
      manager-less club or a world with no userClub. Optional for backward compat. */
  leagueManagerStats?: ManagerStatsDto | null;
  /** Trophies unlocked this run (SeasonsService.finalizeRun's persisted Achievement rows echoed
      straight back). Optional for backward compat with cache entries saved before Phase 5. */
  trophies?: TrophyKey[];
  /** The domestic Season's id — needed to submit this run to the leaderboard (Phase 6), which is
      scoped to a season the same way finalizeRun is. Optional for backward compat; a cache entry
      saved before Phase 6 just won't offer the submit block until the next fresh run. */
  domesticSeasonId?: string;
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
  // What MatchPopupReel is currently revealing — distinct from `domesticMatches` (the full-season
  // list used by the stats hub's match log) since the January split reveals the season in two
  // waves through the same "domestic-replay" phase. `domesticReelHalf` is bumped between waves and
  // used as the reel's `key` so its internal reveal state resets cleanly for the second half.
  const [domesticReelMatches, setDomesticReelMatches] = useState<MatchSummaryDto[]>([]);
  const [domesticReelHalf, setDomesticReelHalf] = useState(0);
  // True while the worker is still simulating and the reel is being fed matchday-by-matchday as
  // results land (the "instant start" streaming reveal), so the reel holds instead of finishing.
  const [reelStreaming, setReelStreaming] = useState(false);
  const [januaryOutcome, setJanuaryOutcome] = useState<JanuaryResultDto | null>(null);
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
  // Every europe match across the league phase + all knockout rounds, for the persistent match
  // log on the stats hub — unlike `knockoutMatches` (which the pipeline overwrites each round for
  // the replay), this accumulates across the whole campaign.
  const [europeAllMatches, setEuropeAllMatches] = useState<MatchSummaryDto[]>([]);

  // Final stats hub: league and (if qualified) Champions League stats live side by side behind a
  // tab toggle instead of a one-shot "summary" screen, so the user can freely flip between them
  // afterward rather than only ever seeing whichever one the linear pipeline ended on.
  const [statsTab, setStatsTab] = useState<StatsTab>("league");
  const [leagueCompetitionStats, setLeagueCompetitionStats] = useState<CompetitionStatsDto | null>(null);
  const [leagueManagerStats, setLeagueManagerStats] = useState<ManagerStatsDto | null>(null);
  const [europeCompetitionStats, setEuropeCompetitionStats] = useState<CompetitionStatsDto | null>(null);
  const [europeTeamStats, setEuropeTeamStats] = useState<TeamStatsDto | null>(null);
  const [trophies, setTrophies] = useState<TrophyKey[]>([]);
  const [domesticSeasonId, setDomesticSeasonId] = useState<string | null>(null);

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

  /**
   * The "instant start" reveal: instead of waiting for the whole 380-fixture season to finish
   * simulating (~60-90s against Neon) before showing anything, we drop straight into the reel and
   * poll for the user's own fixtures as the worker completes each matchday, feeding them in live.
   * The reel starts within a couple seconds (as soon as matchday 1 lands) and stays fed because a
   * full replay (~38 cards paced a couple seconds each) takes about as long as the simulation does.
   *
   * `toMatchday` bounds the reveal to a matchday range (the January first half stops at the midpoint;
   * `null` streams to the end of the season). Returns once the reel has finished revealing — either
   * naturally (all in-range matches shown after simulation of that range completed) or via "Skip".
   */
  async function streamDomesticReel(
    wId: string,
    seasonId: string,
    userClubId: string | undefined,
    opts: { fromMatchday: number; toMatchday: number | null; half: 0 | 1 },
  ): Promise<void> {
    setDomesticReelMatches([]);
    setDomesticReelHalf(opts.half);
    setReelStreaming(true);
    setPhase("domestic-replay");

    const replayDone = waitForReplay();
    let stopped = false;
    void replayDone.then(() => {
      stopped = true; // "Skip ahead" fires onComplete early — stop polling
    });
    const inRange = (m: MatchSummaryDto) =>
      m.matchday >= opts.fromMatchday && (opts.toMatchday === null || m.matchday <= opts.toMatchday);
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let rangeDone = false;
    while (!rangeDone && !stopped) {
      const [season, userMatches] = await Promise.all([
        api.getSeason(wId, seasonId),
        api.getMatchesWithEvents(wId, seasonId, userClubId),
      ]);
      setDomesticReelMatches(userMatches.filter(inRange));
      rangeDone =
        opts.toMatchday === null
          ? season.status === "COMPLETED"
          : (() => {
              const upTo = season.fixtures.filter((f) => f.matchday <= opts.toMatchday!);
              return upTo.length > 0 && upTo.every((f) => f.status === "COMPLETED");
            })();
      if (!rangeDone && !stopped) await sleep(900);
    }

    setReelStreaming(false); // range fully simulated — let the reel reveal any backlog and finish
    await replayDone;
  }

  const januaryResolveRef = useRef<((result: JanuaryResultDto | null) => void) | null>(null);
  function waitForJanuary(): Promise<JanuaryResultDto | null> {
    return new Promise((resolve) => {
      januaryResolveRef.current = resolve;
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
        setDomesticMatches(cached.domesticMatches ?? []);
        setEuropeAllMatches(cached.europeMatches ?? []);
        setJanuaryOutcome(cached.januaryOutcome ?? null);
        setLeagueManagerStats(cached.leagueManagerStats ?? null);
        setTrophies(cached.trophies ?? []);
        setDomesticSeasonId(cached.domesticSeasonId ?? null);
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
    setDomesticSeasonId(domesticSeasonId);

    // The January Transfer Window pauses the domestic season at its exact halfway matchday —
    // derived from the already-generated fixture list (double round-robin, so the total is always
    // even), never hardcoded. Off (or no human club to act on) falls back to the original one-shot
    // simulate-then-reveal flow below, unchanged.
    const totalMatchdays = Math.max(0, ...domesticSeason.fixtures.map((f) => f.matchday));
    const midMatchday = Math.floor(totalMatchdays / 2);
    const januaryEnabled = (w.settings?.januaryWindow ?? true) && Boolean(userClub) && midMatchday > 0 && midMatchday < totalMatchdays;

    let matches: MatchSummaryDto[];
    let standingsRes: StandingsDto;
    let outcome: JanuaryResultDto | null = null;

    if (januaryEnabled) {
      // First half streams in live as the worker simulates matchdays 1..mid (no upfront wait).
      await api.simulateSeason(wId, domesticSeasonId, { throughMatchday: midMatchday });
      await streamDomesticReel(wId, domesticSeasonId, userClub?.id, {
        fromMatchday: 1,
        toMatchday: midMatchday,
        half: 0,
      });

      setPhase("january");
      outcome = await waitForJanuary();
      setJanuaryOutcome(outcome);

      // Second half streams in the same way once the roster change is locked in.
      await api.simulateSeason(wId, domesticSeasonId);
      await streamDomesticReel(wId, domesticSeasonId, userClub?.id, {
        fromMatchday: midMatchday + 1,
        toMatchday: null,
        half: 1,
      });

      setPhase("simulating");
      setSimulatingLabel("Wrapping up the season…");
      await pollUntilCompleted(wId, domesticSeasonId); // instant unless the user skipped ahead
      const [allMatches, finalStandings] = await Promise.all([
        api.getMatchesWithEvents(wId, domesticSeasonId),
        api.getStandings(wId, domesticSeasonId),
      ]);
      matches = allMatches;
      standingsRes = finalStandings;
    } else {
      await api.simulateSeason(wId, domesticSeasonId);
      await streamDomesticReel(wId, domesticSeasonId, userClub?.id, {
        fromMatchday: 1,
        toMatchday: null,
        half: 0,
      });

      setPhase("simulating");
      setSimulatingLabel("Wrapping up the season…");
      await pollUntilCompleted(wId, domesticSeasonId); // instant unless the user skipped ahead
      const [m, s] = await Promise.all([
        api.getMatchesWithEvents(wId, domesticSeasonId),
        api.getStandings(wId, domesticSeasonId),
      ]);
      matches = m;
      standingsRes = s;
    }

    setDomesticMatches(matches);
    setStandings(standingsRes);

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
    const managerStats = userClub ? await api.getManagerStats(wId, domesticSeason.competitionId, userClub.id) : null;
    setLeagueManagerStats(managerStats);

    // Persists trophies/awards/records for this run (see finalizeRun's own doc comment for why this
    // is the caller's job, not the worker's). A failure here is a shame, not a crash — the reveal
    // and every other stats-hub panel already succeeded, so trophies just quietly default to none.
    const finalizeResult = userClub ? await api.finalizeRun(wId, domesticSeasonId).catch(() => null) : null;
    const unlockedTrophies = finalizeResult?.trophies ?? [];
    setTrophies(unlockedTrophies);

    // Phase 9a: a league member's run reports itself automatically — the whole point of a league is
    // comparing everyone's result, so it can't depend on each member remembering to click the
    // (separate, opt-in) public-leaderboard Submit button below. Reuses that same submitToLeaderboard
    // call — a league standing IS a public leaderboard entry, just also joined into a league's own
    // member list server-side (see LeaguesService.getStandings); it isn't a parallel system.
    if (userClub && w.settings?.multiplayerLeagueId) {
      await api
        .submitToLeaderboard(wId, domesticSeasonId, { handle: userClub.name, difficulty: config.difficulty, ratingsMode: config.playerRatings })
        .catch(() => {
          // Best-effort — a failed auto-submit just leaves this member's league standing showing
          // "in progress" a little longer; the manual Submit block below can still recover it.
        });
    }

    // The Setup "European Nights" toggle (default on) opts a world out of continental football
    // entirely — "Off = just the league" — even for a qualifying finish. `settings` is null for
    // worlds created before this toggle was wired, which defaults to the toggle's own on-by-default.
    const europeanNightsEnabled = w.settings?.europeanNights ?? true;
    const status: Pick<EuropeStatusDto, "qualified"> = europeanNightsEnabled
      ? await api.getEuropeStatus(wId, domesticSeasonId)
      : { qualified: false };
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
        domesticMatches: matches,
        europeMatches: [],
        januaryOutcome: outcome,
        leagueManagerStats: managerStats,
        trophies: unlockedTrophies,
        domesticSeasonId,
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
    const {
      champion: finalChampion,
      ties: finalTies,
      matches: knockoutHistory,
    } = await runKnockoutRound(wId, competitionId, qf);
    const europeMatches = [...leagueMatches, ...knockoutHistory];
    setEuropeAllMatches(europeMatches);

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
      domesticMatches: matches,
      europeMatches,
      januaryOutcome: outcome,
      leagueManagerStats: managerStats,
      trophies: unlockedTrophies,
      domesticSeasonId,
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
    matchesSoFar: MatchSummaryDto[] = [],
  ): Promise<{ champion: string; ties: KnockoutTieDto[]; matches: MatchSummaryDto[] }> {
    setKnockoutRound(round.round);
    // Same reasoning as the league-phase transition above — this covers both the first entry
    // into the knockout stage and every recursive SF/FINAL call, so no round-to-round transition
    // is ever left showing the previous round's stale result screen during the polling wait.
    setPhase("simulating");
    setSimulatingLabel(`Simulating the ${ROUND_LABEL[round.round]}…`);
    const ties = [...tiesSoFar, ...round.ties];
    setAllTies(ties);
    await pollUntilCompleted(wId, round.seasonId);

    const roundMatches = await api.getMatchesWithEvents(wId, round.seasonId);
    const matches = [...matchesSoFar, ...roundMatches];
    setKnockoutMatches(roundMatches);
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
      return { champion: result.champion, ties: resolvedTies, matches };
    }

    if (result.next) {
      return runKnockoutRound(wId, competitionId, result.next, resolvedTies, matches);
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
  // Pulls the user's own W/D/L/Pts out of a standings table for TeamStatsPanel's record row —
  // TeamStatsPanel itself only carries goals/squad stats, not the league record.
  const recordFor = (table: StandingsDto | null) => {
    const row = table?.rows.find((r) => r.clubId === userClub?.id);
    return row ? { won: row.won, drawn: row.drawn, lost: row.lost, points: row.points } : undefined;
  };

  // The season narrative is pure and cheap to (re)compute from data the stats hub already has
  // cached — no separate fetch or cache slot of its own, unlike the fields above.
  const narrative =
    summary && userClub && summary.position !== undefined && summary.userRow
      ? buildSeasonNarrative({
          position: summary.position,
          seasonSize: standings?.rows.length ?? world.clubs.length,
          points: summary.userRow.points,
          clubName: userClub.name,
          userClubId: userClub.id,
          squadOverall: summary.squadOverall,
          squad: summary.squad,
          matches: onlyMine(domesticMatches),
          teamStats,
          januaryOutcome,
          managerPhilosophy: leagueManagerStats?.manager?.philosophy,
          nameFor,
        })
      : null;

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
        <p className="animate-mint-pulse text-center text-sm text-smoke-500">{simulatingLabel}</p>
      )}

      {phase === "domestic-replay" && (
        <MatchPopupReel
          key={`domestic-half-${domesticReelHalf}`}
          matches={onlyMine(domesticReelMatches)}
          clubs={world.clubs}
          userClubId={userClub?.id}
          streaming={reelStreaming}
          onComplete={() => replayResolveRef.current?.()}
        />
      )}

      {phase === "january" && userClub && season && (
        <JanuaryWindow
          matches={onlyMine(domesticReelMatches)}
          userClubId={userClub.id}
          totalMatchdays={Math.max(0, ...season.fixtures.map((f) => f.matchday))}
          matchdaysPlayed={Math.floor(Math.max(0, ...season.fixtures.map((f) => f.matchday)) / 2)}
          onResolve={() => api.resolveJanuaryGamble(world.id, season.id)}
          onDone={(outcome) => januaryResolveRef.current?.(outcome)}
        />
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
          <TeamStatsPanel stats={teamStats} record={recordFor(standings)} />
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
          className="notch space-y-3 border-2 border-mint-400/60 bg-gradient-to-br from-mint-500/15 via-ink-900 to-ink-950 p-8 text-center"
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
            userClubId={userClub?.id}
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
          <MatchPopupReel
            matches={onlyMine(knockoutMatches)}
            clubs={world.clubs}
            userClubId={userClub?.id}
            onComplete={() => replayResolveRef.current?.()}
          />
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
          className="notch space-y-3 border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/20 via-ink-900 to-ink-950 p-8 text-center"
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
            <p className="text-center text-sm text-amber-400">
              {champion === userClub?.id
                ? "European champions this season — the treble of storylines complete!"
                : `${nameFor(champion)} lifted the Champions League this season.`}
            </p>
          )}
          {summary.squadOverall !== undefined && (
            <p className="text-center text-xs text-smoke-500">
              A <span className={TIER_TEXT[squadTierName(summary.squadOverall)]}>{squadTierName(summary.squadOverall)}</span>{" "}
              squad (Overall {summary.squadOverall})
            </p>
          )}

          <TrophyCabinet trophies={trophies} />

          <ShareCard summary={summary} />
          {januaryOutcome && <JanuaryShareCard outcome={januaryOutcome} />}
          {worldId && domesticSeasonId && userClub && (
            <LeaderboardSubmitBlock
              worldId={worldId}
              seasonId={domesticSeasonId}
              difficulty={config.difficulty}
              ratingsMode={config.playerRatings}
              defaultHandle={userClub.name}
            />
          )}
          <GuestPersistPrompt />

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
              {narrative && <SeasonNarrative narrative={narrative} />}
              {leagueCompetitionStats && (
                <CompetitionStatsPanel stats={leagueCompetitionStats} highlightClubId={userClub?.id} />
              )}
              {teamStats && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    {userClub?.name}&apos;s league season
                  </h3>
                  <TeamStatsPanel stats={teamStats} record={recordFor(standings)} />
                </>
              )}
              {leagueManagerStats && <ManagerStatCard stats={leagueManagerStats} clubs={world.clubs} />}
              {domesticMatches.length > 0 && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    Season Results
                  </h3>
                  <MatchLog matches={onlyMine(domesticMatches)} clubs={world.clubs} userClubId={userClub?.id} />
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
                  <TeamStatsPanel stats={europeTeamStats} record={recordFor(europeLeagueStandings)} />
                </>
              )}
              {europeAllMatches.length > 0 && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    Campaign Results
                  </h3>
                  <MatchLog matches={onlyMine(europeAllMatches)} clubs={world.clubs} userClubId={userClub?.id} />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
