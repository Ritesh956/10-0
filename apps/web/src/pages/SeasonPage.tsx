import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type {
  CompetitionStatsDto,
  EuropeDrawDto,
  EuropeRoundDto,
  EuropeStatusDto,
  FixtureDto,
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
import { EuropeDraw } from "../components/EuropeDraw";
import { LeagueBadge } from "../components/LeagueBadge";
import { GuestPersistPrompt } from "../components/GuestPersistPrompt";
import { JanuaryShareCard } from "../components/JanuaryShareCard";
import { JanuaryWindow } from "../components/JanuaryWindow";
import { KnockoutBracket } from "../components/KnockoutBracket";
import { LeaderboardSubmitBlock } from "../components/LeaderboardSubmitBlock";
import { ManagerStatCard } from "../components/ManagerStatCard";
import { MatchLog } from "../components/MatchLog";
import { MatchPopupReel } from "../components/MatchPopupReel";
import { MiniTable } from "../components/MiniTable";
import { NationsCupPanel } from "../components/NationsCupPanel";
import { SeasonNarrative } from "../components/SeasonNarrative";
import { ShareCard } from "../components/ShareCard";
import { StandingsTable } from "../components/StandingsTable";
import { TeamStatsPanel } from "../components/TeamStatsPanel";
import { TrophyCabinet } from "../components/TrophyCabinet";
import { Button } from "../components/ui/Button";
import { fireChampionShower, fireQualificationBurst } from "../lib/confetti";
import { staggerContainer, staggerItem, staggerItemBounce } from "../lib/motion";
import { buildSeasonNarrative } from "../lib/seasonNarrative";
import { worldClubLabel } from "../lib/clubNames";
import { leaguePhaseVerdict, ROUND_LABEL, zoneForPosition, ZONE_LEGEND } from "../lib/europe";
import { leagueLabel, playLeagueIdOf } from "../lib/leagues";
import { loadStatsHubCache, rebuildStatsHub, saveStatsHubCache } from "../lib/statsHubCache";
import { EuropeShareCard } from "../components/EuropeShareCard";
import { squadTierName, TIER_TEXT } from "../lib/squadRatings";
import { useDraft } from "../state/DraftContext";
import { useT } from "../lib/i18n/context";

type Phase =
  | "no-season"
  | "simulating"
  | "domestic-replay"
  | "january"
  | "domestic-standings"
  | "team-stats"
  | "europe-transition"
  | "europe-draw"
  | "europe-league-replay"
  | "europe-league-standings"
  | "europe-knockout-replay"
  | "europe-round-result"
  | "europe-champion"
  | "stats-hub";

type StatsTab = "league" | "europe";

async function pollUntilCompleted(worldId: string, seasonId: string): Promise<void> {
  for (;;) {
    // Check before sleeping: after the streaming reveal the season is usually already COMPLETED, so
    // this returns on the first call with no needless 1.2s pause (only a skip-ahead leaves real work).
    const season = await api.getSeason(worldId, seasonId);
    if (season.status === "COMPLETED") return;
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
}

const KNOCKOUT_STAGE: Record<KnockoutTieDto["round"], { label: string; order: number }> = {
  PO: { label: "Play-off", order: 1 },
  R16: { label: "R16", order: 2 },
  QF: { label: "QF", order: 3 },
  SF: { label: "SF", order: 4 },
  FINAL: { label: "Final", order: 5 },
};

/** Fixture id -> knockout stage label ("QF · Leg 1", "Final") for the Europe campaign log, whose
    league phase and each knockout round all restart matchday numbering at 1. */
function knockoutStageFor(ties: KnockoutTieDto[]) {
  const byFixture = new Map<string, { label: string; order: number }>();
  for (const tie of ties) {
    const stage = KNOCKOUT_STAGE[tie.round];
    if (tie.round === "FINAL") {
      if (tie.firstLegFixtureId) byFixture.set(tie.firstLegFixtureId, { label: "Final", order: stage.order * 10 });
      continue;
    }
    if (tie.firstLegFixtureId) byFixture.set(tie.firstLegFixtureId, { label: `${stage.label} · Leg 1`, order: stage.order * 10 });
    if (tie.secondLegFixtureId) byFixture.set(tie.secondLegFixtureId, { label: `${stage.label} · Leg 2`, order: stage.order * 10 + 1 });
  }
  return (fixtureId: string) => byFixture.get(fixtureId);
}

const cap = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const ORDINAL_SUFFIX = ["th", "st", "nd", "rd"];
function ordinalPosition(n: number): string {
  const v = n % 100;
  return `${n}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? ORDINAL_SUFFIX[0]}`;
}

export function SeasonPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const location = useLocation();
  // Set by DraftPage's "Simulate Season" — that press starts the season; no second click here.
  const autoStart = Boolean((location.state as { autoStart?: boolean } | null)?.autoStart);
  const autoStartedRef = useRef(false);
  const { worldId: draftWorldId, config } = useDraft();
  // "/season?world=<id>" opens a past run (from the profile) without replacing the current draft's world.
  const worldId = new URLSearchParams(location.search).get("world") ?? draftWorldId;

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
  // Matches before this wave's range (the first half, once the post-January wave starts) — handed to
  // the reel so its played-count, W/D/L strip and feed carry on across January instead of resetting.
  const [domesticReelPrior, setDomesticReelPrior] = useState<MatchSummaryDto[]>([]);
  const [domesticReelHalf, setDomesticReelHalf] = useState(0);
  // True while the worker is still simulating and the reel is being fed matchday-by-matchday as
  // results land (the "instant start" streaming reveal), so the reel holds instead of finishing.
  const [reelStreaming, setReelStreaming] = useState(false);
  // "Skip to January" while the first half is revealing and the window is coming, else "Skip to the end".
  const [reelSkipLabel, setReelSkipLabel] = useState("Skip to the end");
  const [januaryOutcome, setJanuaryOutcome] = useState<JanuaryResultDto | null>(null);
  // The table at the halfway mark, for the January panel's "you're 3rd of 20" line.
  const [halfwayStandings, setHalfwayStandings] = useState<StandingsDto | null>(null);
  // The league table as it stands while the season is being revealed — your position ± 2 rows.
  const [liveStandings, setLiveStandings] = useState<StandingsDto | null>(null);
  const [standings, setStandings] = useState<StandingsDto | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStatsDto | null>(null);
  const [summary, setSummary] = useState<SummaryDto | null>(null);

  const [qualified, setQualified] = useState(false);
  const [europeCompetitionId, setEuropeCompetitionId] = useState<string | null>(null);
  const [europeDraw, setEuropeDraw] = useState<EuropeDrawDto | null>(null);
  // 1 = European Nights, 2 = the Continental Cup (a straight knockout for a 9th-12th finish).
  const [europeTier, setEuropeTier] = useState<1 | 2>(1);
  const [cupTies, setCupTies] = useState<KnockoutTieDto[]>([]);
  const [europeFixtures, setEuropeFixtures] = useState<FixtureDto[]>([]);
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

  // Final stats hub: league and (if qualified) European Nights stats live side by side behind a
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
  const europeChoiceRef = useRef<((play: boolean) => void) | null>(null);
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
    setReelSkipLabel(opts.toMatchday !== null ? "Skip to January" : "Skip to the end");
    setDomesticReelMatches([]);
    setDomesticReelPrior([]);
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
      const [season, userMatches, table] = await Promise.all([
        api.getSeason(wId, seasonId),
        api.getMatchesWithEvents(wId, seasonId, userClubId),
        // Best-effort: the table is garnish, a failed fetch just leaves the last one showing.
        api.getStandings(wId, seasonId).catch(() => null),
      ]);
      if (table) setLiveStandings(table);
      setDomesticReelMatches(userMatches.filter(inRange));
      setDomesticReelPrior(userMatches.filter((m) => m.matchday < opts.fromMatchday));
      rangeDone =
        opts.toMatchday === null
          ? season.status === "COMPLETED"
          : (() => {
              const upTo = season.fixtures.filter((f) => f.matchday <= opts.toMatchday!);
              return upTo.length > 0 && upTo.every((f) => f.status === "COMPLETED");
            })();
      if (!rangeDone && !stopped) await sleep(900);
    }

    // The three fetches above run in parallel, so the status can read "complete" a moment after the
    // matches query ran — which would drop the range's last matchday from the reel (and from
    // January's halfway record). Once the range is known to be complete, read the matches again.
    if (rangeDone && !stopped) {
      const [userMatches, table] = await Promise.all([
        api.getMatchesWithEvents(wId, seasonId, userClubId),
        api.getStandings(wId, seasonId).catch(() => null),
      ]);
      if (table) setLiveStandings(table);
      setDomesticReelMatches(userMatches.filter(inRange));
      setDomesticReelPrior(userMatches.filter((m) => m.matchday < opts.fromMatchday));
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
      .then(async (w) => {
        let cached = loadStatsHubCache(worldId);
        // Not cached in this browser (another device, cleared storage, opened from the profile):
        // a world that already has a season may be a finished run — rebuild its hub from the server.
        // The world is set only afterwards, so the page stays on "Loading…" rather than flashing
        // the pre-season screen.
        if (!cached && w.clubs.length > 1) {
          cached = await rebuildStatsHub(worldId).catch(() => null);
          if (cached) saveStatsHubCache(worldId, cached);
        }
        setWorld(w);
        if (!cached) return;
        setStandings(cached.standings);
        setTeamStats(cached.teamStats);
        setLeagueCompetitionStats(cached.leagueCompetitionStats);
        setQualified(cached.qualified);
        setEuropeTier(cached.europeTier ?? 1);
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
        setStatsTab("league");
        setPhase("stats-hub");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load world"));
  }, [worldId, navigate]);

  // A world that still has only the user's club has no season yet — start it once. The ref (not
  // the effect's deps) is the "only once" guard, so a re-render or StrictMode re-run can't create a
  // second season; the router state is cleared so a reload doesn't try again either.
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || !world || phase !== "no-season" || world.clubs.length > 1) return;
    autoStartedRef.current = true;
    navigate(location.pathname, { replace: true, state: null });
    void handleStartSeason();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, world, phase]);

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
      const created = await api.createSeason(worldId, "Fantasy Top Flight", { leagueId: playLeagueIdOf(config) });
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

      setHalfwayStandings(await api.getStandings(wId, domesticSeasonId).catch(() => null));
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
    const status: Pick<EuropeStatusDto, "qualified" | "cup"> = europeanNightsEnabled
      ? await api.getEuropeStatus(wId, domesticSeasonId)
      : { qualified: false };
    // Tier 1 is European Nights (top 8); tier 2 is the Continental Cup (9th-12th). 0 = neither.
    const tier: 0 | 1 | 2 = status.qualified ? 1 : status.cup?.qualified ? 2 : 0;
    setQualified(tier > 0);
    setEuropeTier(tier === 2 ? 2 : 1);

    // Qualifying is an invitation, not an obligation: the player chooses to play (it used to start
    // automatically after a 3s pause) or to go straight to their season review.
    let playEurope = tier > 0;
    if (tier > 0) {
      setPhase("europe-transition");
      playEurope = await new Promise<boolean>((resolve) => {
        europeChoiceRef.current = resolve;
      });
      if (!playEurope) setQualified(false);
    }

    if (!playEurope) {
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

    // Clicking past a pause immediately kicks off a real backend call + polling wait with no
    // MatchPopupReel/animation to fill the gap — without an explicit loading phase here, the
    // screen just sits on the same stale content with the same "Continue" button still showing,
    // which reads as "Continue did nothing" even though the pipeline is actually progressing.
    setPhase("simulating");
    let competitionId: string;
    let leagueMatches: MatchSummaryDto[] = [];
    let leagueStandings: StandingsDto | null = null;
    let firstRound: EuropeRoundDto;

    if (tier === 1) {
      setSimulatingLabel("Drawing European Nights…");
      const { competitionId: cId, seasonId: leaguePhaseSeasonId, draw } = await api.startEuropeLeaguePhase(wId, domesticSeasonId);
      competitionId = cId;
      setEuropeCompetitionId(cId);
      setEuropeDraw(draw);

      // The draw brought clubs from the other four leagues into the world — reload it so every table
      // and result below can name them. The league phase is already simulating in the background
      // while the draw is on screen.
      const [withEurope, leaguePhaseSeason] = await Promise.all([api.getWorld(wId), api.getSeason(wId, leaguePhaseSeasonId)]);
      setWorld(withEurope);
      setEuropeFixtures(leaguePhaseSeason.fixtures);
      setPhase("europe-draw");
      await pause(15000);

      setPhase("simulating");
      setSimulatingLabel("Playing the league phase…");
      await pollUntilCompleted(wId, leaguePhaseSeasonId);

      const [lm, ls] = await Promise.all([
        api.getMatchesWithEvents(wId, leaguePhaseSeasonId),
        api.getLeaguePhaseStandings(wId, leaguePhaseSeasonId),
      ]);
      leagueMatches = lm;
      leagueStandings = ls;
      setEuropeLeagueMatches(lm);
      setEuropeLeagueStandings(ls);
      setPhase("europe-league-replay");
      await waitForReplay();

      setPhase("europe-league-standings");
      await pause(4000);

      // This is the one deliberate, required checkpoint in the whole knockout stage — everything
      // from here (play-off -> R16 -> QF -> SF -> Final -> champion) plays straight through with no
      // further "Continue" clicks needed, only brief auto-advancing pauses (see runKnockoutRound).
      setPhase("simulating");
      setSimulatingLabel("Setting up the knockouts…");
      firstRound = await api.startEuropeKnockouts(wId, cId, leaguePhaseSeasonId);
    } else {
      // The Continental Cup is a straight knockout: draw, then the same round-by-round pipeline.
      setSimulatingLabel("Drawing the Continental Cup…");
      const cup = await api.startEuropeCup(wId, domesticSeasonId);
      competitionId = cup.competitionId;
      setEuropeCompetitionId(cup.competitionId);
      setEuropeDraw(cup.draw);
      setCupTies(cup.round.ties);
      setWorld(await api.getWorld(wId));
      setEuropeFixtures([]);
      setPhase("europe-draw");
      await pause(15000);
      firstRound = cup.round;
    }

    const {
      champion: finalChampion,
      ties: finalTies,
      matches: knockoutHistory,
    } = await runKnockoutRound(wId, competitionId, firstRound, [], [], userClub?.id);
    const europeMatches = [...leagueMatches, ...knockoutHistory];
    setEuropeAllMatches(europeMatches);

    const [summaryRes, europeStats, europeTeam, europeFinalize] = await Promise.all([
      api.getSummary(wId, domesticSeasonId),
      api.getCompetitionStats(wId, competitionId),
      userClub ? api.getTeamStatsForCompetition(wId, competitionId, userClub.id) : Promise.resolve(null),
      // Second (idempotent) finalize now that the Final exists — the first ran before Europe, so it
      // couldn't award the European trophies ("european-champion" / "the-double" / the cup's).
      userClub ? api.finalizeRun(wId, domesticSeasonId).catch(() => null) : Promise.resolve(null),
    ]);
    const runTrophies = europeFinalize?.trophies ?? unlockedTrophies;
    setTrophies(runTrophies);
    setSummary(summaryRes);
    setEuropeCompetitionStats(europeStats);
    setEuropeTeamStats(europeTeam);
    setStatsTab("league");
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
      trophies: runTrophies,
      domesticSeasonId,
      europeTier: tier === 2 ? 2 : 1,
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
    userClubId?: string,
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
    // A club that's out (or sat the round out on a bye) has nothing to replay — an empty reel with a
    // 0-0-0 strip is just noise, so go straight to the round's results.
    const userPlayed = !userClubId || roundMatches.some((m) => m.homeClubId === userClubId || m.awayClubId === userClubId);
    if (userPlayed) {
      setPhase("europe-knockout-replay");
      await waitForReplay();
    }

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
      return runKnockoutRound(wId, competitionId, result.next, resolvedTies, matches, userClubId);
    }

    throw new Error("Knockout stage ended without a champion");
  }

  if (!world) {
    return <p className="px-6 py-16 text-center text-smoke-500">{error ?? "Loading..."}</p>;
  }

  const userClub = world.clubs.find((c) => c.managedByUserId);
  const europeName = europeTier === 2 ? "Continental Cup" : "European Nights";
  const europeLabel = t(europeTier === 2 ? "europe.cup" : "europe.nights");
  const userPhasePosition =
    userClub && europeLeagueStandings ? europeLeagueStandings.rows.findIndex((r) => r.clubId === userClub.id) + 1 : 0;
  const nameFor = (clubId: string) => worldClubLabel(world.clubs.find((c) => c.id === clubId), clubId);
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
          shownProjectedFinish: world.settings?.projection?.finish,
          leagueId: world.settings?.leagueId ?? playLeagueIdOf(config),
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
        <div className="mt-2 flex justify-center">
          <LeagueBadge leagueId={world.settings?.leagueId ?? playLeagueIdOf(config)} />
        </div>
        <p className="mt-1 text-sm text-smoke-500">
          {world.clubs.length > 1
            ? // European Nights adds other leagues' clubs to the world; the league is its own table.
              t("season.leagueClubs", { n: standings?.rows.length ?? world.clubs.length })
            : "Your XI is ready — kick off when you are."}
        </p>
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      {phase === "no-season" && (
        <div className="text-center">
          <Button size="lg" disabled={busy} onClick={() => void handleStartSeason()}>
            {busy ? "…" : `${t("season.simulate")} →`}
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
          priorMatches={onlyMine(domesticReelPrior)}
          clubs={world.clubs}
          userClubId={userClub?.id}
          streaming={reelStreaming}
          skipLabel={reelSkipLabel}
          onComplete={() => replayResolveRef.current?.()}
        />
      )}

      {phase === "domestic-replay" && userClub && (
        <MiniTable standings={liveStandings} clubs={world.clubs} userClubId={userClub.id} title={t("season.liveTable")} />
      )}

      {phase === "january" && userClub && season && (
        <JanuaryWindow
          matches={onlyMine(domesticReelMatches)}
          userClubId={userClub.id}
          totalMatchdays={Math.max(0, ...season.fixtures.map((f) => f.matchday))}
          matchdaysPlayed={Math.floor(Math.max(0, ...season.fixtures.map((f) => f.matchday)) / 2)}
          tablePosition={(() => {
            const idx = halfwayStandings?.rows.findIndex((r) => r.clubId === userClub.id) ?? -1;
            return idx >= 0 ? idx + 1 : undefined;
          })()}
          leagueSize={halfwayStandings?.rows.length}
          onOffer={() => api.getJanuaryOffer(world.id, season.id)}
          onResolve={(choiceId) => api.resolveJanuaryGamble(world.id, season.id, choiceId)}
          onDone={(outcome) => januaryResolveRef.current?.(outcome)}
        />
      )}

      {phase === "january" && userClub && (
        <MiniTable
          standings={halfwayStandings ?? liveStandings}
          clubs={world.clubs}
          userClubId={userClub.id}
          radius={4}
          title={t("season.halfwayTable")}
        />
      )}

      {phase === "domestic-standings" && standings && (
        <div className="space-y-4">
          <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
            {t("season.finalStandings")}
          </h2>
          <StandingsTable standings={standings} clubs={world.clubs} highlightClubId={userClub?.id} />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={skipPause}>
              {t("season.continue")} &rarr;
            </Button>
          </div>
        </div>
      )}

      {phase === "team-stats" && teamStats && (
        <div className="space-y-4">
          <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
            {t("season.clubSeason", { club: userClub?.name ?? "" })}
          </h2>
          <TeamStatsPanel stats={teamStats} record={recordFor(standings)} />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={skipPause}>
              {t("season.continue")} &rarr;
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
            {t(europeTier === 2 ? "europe.cupQualified" : "europe.qualified", { club: userClub?.name ?? "" })}
          </motion.h2>
          <motion.p variants={staggerItem} className="text-sm text-smoke-400">
            {europeTier === 2
              ? "Europe's second tier: 16 clubs from the five big leagues in a straight knockout — Round of 16, quarter-finals, semi-finals and a single-match Final."
              : "Europe comes calling: 36 clubs from the five big leagues, eight league-phase games against rivals from abroad, then the knockouts — play-offs, Round of 16, all the way to the Final."}
          </motion.p>
          <motion.div variants={staggerItem} className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={() => europeChoiceRef.current?.(true)}>
              {t(europeTier === 2 ? "europe.enterCup" : "europe.continue")} &rarr;
            </Button>
            <Button variant="ghost" size="sm" onClick={() => europeChoiceRef.current?.(false)}>
              {t("europe.skip")}
            </Button>
          </motion.div>
        </motion.div>
      )}

      {phase === "europe-draw" && europeDraw && (
        <EuropeDraw
          draw={europeDraw}
          clubs={world.clubs}
          userClubId={userClub?.id}
          fixtures={europeFixtures}
          cup={europeTier === 2 ? { ties: cupTies } : undefined}
          onContinue={skipPause}
        />
      )}

      {phase === "europe-league-replay" && (
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
            European Nights &middot; League Phase
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
            {t("europe.nights")} &middot; {t("europe.leaguePhaseStandings")}
          </h2>
          {userPhasePosition > 0 && (
            <p className="text-center text-sm text-smoke-300">{leaguePhaseVerdict(userPhasePosition)}</p>
          )}
          <StandingsTable
            standings={europeLeagueStandings}
            clubs={world.clubs}
            highlightClubId={userClub?.id}
            zoneFor={zoneForPosition}
            legend={ZONE_LEGEND}
            showFlags
          />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={skipPause}>
              {t("europe.continueKnockouts")} &rarr;
            </Button>
          </div>
        </div>
      )}

      {phase === "europe-knockout-replay" && knockoutRound && (
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-600">
            {europeLabel} &middot; {ROUND_LABEL[knockoutRound]}
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
          {knockoutRound === "PO" && (
            <p className="text-sm text-smoke-400">The top eight from the league phase wait in the Round of 16.</p>
          )}
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
            {t(europeTier === 2 ? "europe.cupWinners" : "europe.champions")}
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
                ? summary.position === 1
                  ? europeTier === 2
                    ? "League champions and Continental Cup winners in the same season!"
                    : "The Double — league champions and European champions in the same season!"
                  : europeTier === 2
                    ? "Continental Cup winners this season!"
                    : "European champions this season!"
                : `${nameFor(champion)} won the ${europeName} this season.`}
            </p>
          )}
          {summary.position !== undefined && summary.userRow && (
            <div className="notch border border-ink-800 bg-ink-900/50 p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-smoke-500">{t("season.finalPosition")}</p>
              <p className="font-display text-4xl font-bold text-paper">
                {summary.position === 1 ? t("season.champions") : ordinalPosition(summary.position)}
              </p>
              <p className="mt-1 text-sm text-smoke-400">
                {summary.userRow.won}W {summary.userRow.drawn}D {summary.userRow.lost}L &middot;{" "}
                <span className="font-semibold text-paper">{summary.userRow.points} pts</span>
                {summary.squadOverall !== undefined && (
                  <>
                    {" "}
                    &middot; <span className={TIER_TEXT[squadTierName(summary.squadOverall)]}>{squadTierName(summary.squadOverall)}</span>{" "}
                    (Overall {summary.squadOverall})
                  </>
                )}
              </p>
            </div>
          )}

          {/* The story is the hero: it used to sit under a 20-row table at the bottom of a tab. */}
          {narrative && <SeasonNarrative narrative={narrative} />}

          <TrophyCabinet trophies={trophies} />

          {worldId && userClub && domesticSeasonId && (
            <NationsCupPanel
              worldId={worldId}
              domesticSeasonId={domesticSeasonId}
              userClubId={userClub.id}
              onTrophies={(keys) => setTrophies((prev) => [...new Set([...prev, ...(keys as TrophyKey[])])])}
            />
          )}

          <ShareCard
            summary={summary}
            subtitle={[leagueLabel(world.settings?.leagueId ?? playLeagueIdOf(config)), world.settings?.draftPool === "all" ? "All Top-5 draft" : "", config.formation, cap(config.difficulty)]
              .filter(Boolean)
              .join(" · ")}
            lines={[
              ...(narrative ? [narrative.verdict.label.toLowerCase().replace(/^./, (c) => c.toUpperCase())] : []),
              ...(summary.squadOverall !== undefined ? [`${squadTierName(summary.squadOverall)} XI · Overall ${summary.squadOverall}`] : []),
            ]}
          />
          {januaryOutcome && <JanuaryShareCard outcome={januaryOutcome} clubName={userClub?.name} />}
          {qualified && champion && userClub && (
            <EuropeShareCard competitionName={europeName} clubName={userClub.name} champion={champion === userClub.id} championName={nameFor(champion)} ties={allTies} userClubId={userClub.id} />
          )}
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
              <Button variant={statsTab === "league" ? "primary" : "outline"} size="sm" onClick={() => setStatsTab("league")}>
                {t("season.league")}
              </Button>
              <Button variant={statsTab === "europe" ? "primary" : "outline"} size="sm" onClick={() => setStatsTab("europe")}>
                {europeLabel}
              </Button>
            </div>
          )}

          {statsTab === "league" && standings && (
            <div className="space-y-4">
              {leagueCompetitionStats && (
                <CompetitionStatsPanel
                  stats={leagueCompetitionStats}
                  highlightClubId={userClub?.id}
                  leagueId={world.settings?.leagueId ?? playLeagueIdOf(config)}
                />
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
              <details className="notch border border-ink-800 bg-ink-900/40 p-3">
                <summary className="cursor-pointer select-none text-center font-display text-sm font-semibold uppercase tracking-wide text-paper">
                  {t("season.table")}
                </summary>
                <div className="mt-3">
                  <StandingsTable standings={standings} clubs={world.clubs} highlightClubId={userClub?.id} />
                </div>
              </details>
              {domesticMatches.length > 0 && (
                <details className="notch border border-ink-800 bg-ink-900/40 p-3">
                  <summary className="cursor-pointer select-none text-center font-display text-sm font-semibold uppercase tracking-wide text-paper">
                    All {onlyMine(domesticMatches).length} results
                  </summary>
                  <div className="mt-3">
                    <MatchLog matches={onlyMine(domesticMatches)} clubs={world.clubs} userClubId={userClub?.id} />
                  </div>
                </details>
              )}
            </div>
          )}

          {statsTab === "europe" && qualified && (
            <div className="space-y-4">
              <h2 className="text-center font-display text-lg font-semibold uppercase tracking-wide text-paper">
                {europeLabel}
              </h2>
              {allTies.length > 0 && <KnockoutBracket ties={allTies} clubs={world.clubs} highlightClubId={userClub?.id} />}
              {europeLeagueStandings && (
                <details className="notch border border-ink-800 bg-ink-900/40 p-3">
                  <summary className="cursor-pointer select-none text-center font-display text-sm font-semibold uppercase tracking-wide text-paper">
                    League phase table
                  </summary>
                  <div className="mt-3">
                    <StandingsTable
                      standings={europeLeagueStandings}
                      clubs={world.clubs}
                      highlightClubId={userClub?.id}
                      zoneFor={zoneForPosition}
                      legend={ZONE_LEGEND}
                      showFlags
                    />
                  </div>
                </details>
              )}
              {europeCompetitionStats && (
                <CompetitionStatsPanel stats={europeCompetitionStats} highlightClubId={userClub?.id} />
              )}
              {europeTeamStats && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    {userClub?.name}&apos;s European run
                  </h3>
                  <TeamStatsPanel stats={europeTeamStats} record={recordFor(europeLeagueStandings)} />
                </>
              )}
              {europeAllMatches.length > 0 && (
                <>
                  <h3 className="text-center font-display text-base font-semibold uppercase tracking-wide text-paper">
                    Campaign Results
                  </h3>
                  <MatchLog
                    matches={onlyMine(europeAllMatches)}
                    clubs={world.clubs}
                    userClubId={userClub?.id}
                    stageFor={knockoutStageFor(allTies)}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
