import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SeasonDto, StandingsDto, TeamStatsDto, WorldDto } from "../api/types";

const { fireQualificationBurst, fireChampionShower, fireTitleBurst, fireUnbeatenBurst } = vi.hoisted(() => ({
  fireQualificationBurst: vi.fn(),
  fireChampionShower: vi.fn(),
  fireTitleBurst: vi.fn(),
  fireUnbeatenBurst: vi.fn(),
}));
vi.mock("../lib/confetti", () => ({ fireQualificationBurst, fireChampionShower, fireTitleBurst, fireUnbeatenBurst }));

const { useDraftMock } = vi.hoisted(() => ({ useDraftMock: vi.fn() }));
vi.mock("../state/DraftContext", () => ({ useDraft: useDraftMock }));

// GuestPersistPrompt (rendered in the stats hub) calls useAuth() — mocked here the same way
// useDraft is, defaulting to a signed-up (non-guest) user so it renders nothing in every test
// that doesn't care about it.
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../lib/auth-context", () => ({ useAuth: useAuthMock }));

const api = vi.hoisted(() => ({
  getWorld: vi.fn(),
  createSeason: vi.fn(),
  simulateSeason: vi.fn(),
  getSeason: vi.fn(),
  getMatchesWithEvents: vi.fn(),
  getStandings: vi.fn(),
  getTeamStats: vi.fn(),
  getCompetitionStats: vi.fn(),
  getTeamStatsForCompetition: vi.fn(),
  getEuropeStatus: vi.fn(),
  startEuropeLeaguePhase: vi.fn(),
  startEuropeKnockouts: vi.fn(),
  advanceEuropeKnockouts: vi.fn(),
  getLeaguePhaseStandings: vi.fn(),
  getSummary: vi.fn(),
  resolveJanuaryGamble: vi.fn(),
  getManagerStats: vi.fn(),
  finalizeRun: vi.fn(),
}));
vi.mock("../api/client", () => ({ api }));

import { SeasonPage } from "./SeasonPage";

const world: WorldDto = {
  id: "w1",
  clubs: [
    { id: "user-club", name: "Our XI", managedByUserId: "u1", refClubSeasonId: null },
    { id: "ai-club", name: "Rival FC", managedByUserId: null, refClubSeasonId: null },
  ],
};

const season: SeasonDto = { id: "s1", worldId: "w1", competitionId: "c1", year: 2024, status: "IN_PROGRESS", fixtures: [] };
const completedSeason: SeasonDto = { ...season, status: "COMPLETED" };
const standings: StandingsDto = {
  rows: [
    { clubId: "user-club", played: 38, won: 30, drawn: 5, lost: 3, goalsFor: 90, goalsAgainst: 30, points: 95 },
    { clubId: "ai-club", played: 38, won: 20, drawn: 5, lost: 13, goalsFor: 60, goalsAgainst: 50, points: 65 },
  ],
};
const teamStats: TeamStatsDto = { clubId: "user-club", goalsFor: 90, goalsAgainst: 30, squad: [] };

function setup() {
  useDraftMock.mockReturnValue({ worldId: "w1", config: { leagueIds: ["league-1"] } });
  useAuthMock.mockReturnValue({ user: { id: "u1", email: null, displayName: "Tester", isGuest: false }, isAuthenticated: true });
  api.getWorld.mockResolvedValue(world);
  api.createSeason.mockResolvedValue(season);
  api.simulateSeason.mockResolvedValue({ status: "ok" });
  api.getSeason.mockResolvedValue(completedSeason);
  api.getMatchesWithEvents.mockResolvedValue([]); // empty on purpose — exercises the fixed empty-list path fast
  api.getStandings.mockResolvedValue(standings);
  api.getTeamStats.mockResolvedValue(teamStats);
  api.getCompetitionStats.mockResolvedValue({ topScorers: [], goldenBoot: undefined, mvp: undefined });
  api.getTeamStatsForCompetition.mockResolvedValue(teamStats);
  api.getManagerStats.mockResolvedValue({ manager: null, cleanSheets: 0, longestWinStreak: 0 });
  api.finalizeRun.mockResolvedValue({ trophies: [], awards: [], records: [] });
}

describe("SeasonPage — qualification confetti wiring", () => {
  afterEach(() => {
    vi.clearAllMocks();
    // SeasonPage caches a finished run's stats to real localStorage keyed by worldId (see
    // saveStatsHubCache) — every test here reuses "w1", so a later test would otherwise load an
    // earlier test's cached run and skip straight to the stats hub instead of exercising the flow.
    localStorage.clear();
  });

  it("fires the qualification confetti exactly once when reaching the europe-transition phase", async () => {
    setup();
    api.getEuropeStatus.mockResolvedValue({ qualified: true, position: 1, qualifierCount: 8, ties: [] });

    const { getByRole, findByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    // domestic-standings pause — skip it instead of waiting out the real 4s.
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    // team-stats pause — skip it too.
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await waitFor(() => expect(fireQualificationBurst).toHaveBeenCalledTimes(1), { timeout: 5000, interval: 50 });
    expect(fireChampionShower).not.toHaveBeenCalled();
  }, 15000);

  it("does not fire qualification confetti when the user's club did not qualify", async () => {
    setup();
    api.getEuropeStatus.mockResolvedValue({ qualified: false, position: 12, qualifierCount: 8, ties: [] });
    api.getSummary.mockResolvedValue({ standings, unbeaten: false });

    const { getByRole, findByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000, interval: 50 });
    expect(fireQualificationBurst).not.toHaveBeenCalled();
  }, 15000);

  it("skips Europe entirely when the world's europeanNights setting is off, even on a qualifying finish", async () => {
    setup();
    api.getWorld.mockResolvedValue({ ...world, settings: { europeanNights: false, januaryWindow: true } });
    // If the gate didn't work, this qualifying status would drive the pipeline into Europe instead.
    api.getEuropeStatus.mockResolvedValue({ qualified: true, position: 1, qualifierCount: 8, ties: [] });
    api.getSummary.mockResolvedValue({ standings, unbeaten: false });

    const { getByRole, findByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000, interval: 50 });
    expect(api.getEuropeStatus).not.toHaveBeenCalled();
    expect(fireQualificationBurst).not.toHaveBeenCalled();
  }, 15000);
});

describe("SeasonPage — one required Continue press carries the whole knockout stage through", () => {
  afterEach(() => {
    vi.clearAllMocks();
    // SeasonPage caches a finished run's stats to real localStorage keyed by worldId (see
    // saveStatsHubCache) — every test here reuses "w1", so a later test would otherwise load an
    // earlier test's cached run and skip straight to the stats hub instead of exercising the flow.
    localStorage.clear();
  });

  it("requires a Continue click through domestic standings, team stats, and Europe transition, one more into the knockouts, then auto-advances through every round result and the champion screen with no further clicks", async () => {
    setup();
    api.getEuropeStatus.mockResolvedValue({ qualified: true, position: 1, qualifierCount: 8, ties: [] });
    api.startEuropeLeaguePhase.mockResolvedValue({ competitionId: "euro-c1", seasonId: "s-league" });
    api.getLeaguePhaseStandings.mockResolvedValue(standings);
    api.startEuropeKnockouts.mockResolvedValue({
      round: "QF",
      seasonId: "s-qf",
      ties: [{ id: "t-qf", round: "QF", homeClubId: "user-club", awayClubId: "ai-club", firstLegFixtureId: null, secondLegFixtureId: null, winnerClubId: null, wentToPenalties: false }],
    });
    api.advanceEuropeKnockouts.mockImplementation(async (_wId: string, _cId: string, round: string) => {
      const tie = { id: `t-${round}`, round, homeClubId: "user-club", awayClubId: "ai-club", firstLegFixtureId: null, secondLegFixtureId: null, winnerClubId: "user-club", wentToPenalties: false };
      if (round === "QF") return { resolvedRound: "QF", resolvedTies: [tie], next: { round: "SF", seasonId: "s-sf", ties: [tie] } };
      if (round === "SF") return { resolvedRound: "SF", resolvedTies: [tie], next: { round: "FINAL", seasonId: "s-final", ties: [tie] } };
      return { resolvedRound: "FINAL", resolvedTies: [tie], champion: "user-club" };
    });
    api.getSummary.mockResolvedValue({ standings, userClub: { id: "user-club", name: "Our XI" }, userRow: standings.rows[0], position: 1, unbeaten: false });

    const { getByRole, findByText, findByRole, queryByRole } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    // domestic-standings
    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    // team-stats
    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    // europe-transition
    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    // europe-league-standings — "Continue to Knockouts" is the last press needed; everything
    // from here on (QF -> SF -> Final -> champion) auto-advances with no button of its own.
    await findByRole("button", { name: /continue to knockouts/i }, { timeout: 5000 });
    getByRole("button", { name: /continue to knockouts/i }).click();

    // europe-round-result (QF) — no button; auto-advances into SF after a short pause
    await findByText(/quarter-final results/i, {}, { timeout: 5000 });
    expect(queryByRole("button", { name: /^continue/i })).toBeNull();

    // europe-round-result (SF) — likewise auto-advances into the Final
    await findByText(/semi-final results/i, {}, { timeout: 5000 });
    expect(queryByRole("button", { name: /^continue/i })).toBeNull();

    // europe-champion — auto-advances straight into fetching the stats hub, no click needed
    await findByText(/champions league winners/i, {}, { timeout: 15000 });
    expect(queryByRole("button", { name: /^continue/i })).toBeNull();

    // stats-hub
    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 10000, interval: 50 });
    await findByText(/season result/i, {}, { timeout: 10000 });
  }, 30000);
});

describe("SeasonPage — January Transfer Window pause", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // A small 4-matchday season (mid = 2) is enough to exercise the halfway split — the pause logic
  // only cares that 0 < mid < total, not that the numbers match a real 20-club league.
  const halfSeason: SeasonDto = {
    id: "s1",
    worldId: "w1",
    competitionId: "c1",
    year: 2024,
    status: "IN_PROGRESS",
    fixtures: [1, 2, 3, 4].map((matchday) => ({
      id: `f${matchday}`,
      matchday,
      homeClubId: "user-club",
      awayClubId: "ai-club",
      status: "SCHEDULED",
      matchId: null,
    })),
  };
  const halfSeasonAllDone: SeasonDto = {
    ...halfSeason,
    status: "COMPLETED",
    fixtures: halfSeason.fixtures.map((f) => ({ ...f, status: "COMPLETED", matchId: `m${f.matchday}` })),
  };

  function setupJanuary(januaryWindow: boolean) {
    useDraftMock.mockReturnValue({ worldId: "w1", config: { leagueIds: ["league-1"] } });
    useAuthMock.mockReturnValue({ user: { id: "u1", email: null, displayName: "Tester", isGuest: false }, isAuthenticated: true });
    api.getWorld.mockResolvedValue({ ...world, settings: { europeanNights: false, januaryWindow } });
    api.createSeason.mockResolvedValue(halfSeason);
    api.simulateSeason.mockResolvedValue({ status: "ok" });
    api.getSeason.mockResolvedValue(halfSeasonAllDone);
    api.getMatchesWithEvents.mockResolvedValue([]);
    api.getStandings.mockResolvedValue(standings);
    api.getTeamStats.mockResolvedValue(teamStats);
    api.getCompetitionStats.mockResolvedValue({ topScorers: [], goldenBoot: undefined, mvp: undefined });
    api.getSummary.mockResolvedValue({ standings, unbeaten: false });
    api.getManagerStats.mockResolvedValue({ manager: null, cleanSheets: 0, longestWinStreak: 0 });
    api.finalizeRun.mockResolvedValue({ trophies: [], awards: [], records: [] });
  }

  it("pauses at the halfway matchday, then resumes the back half once the user sticks with their XI", async () => {
    setupJanuary(true);

    const { getByRole, findByText, findByRole } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/halfway there/i, {}, { timeout: 8000 });
    // The first half was simulated up to the derived midpoint, not the whole season.
    expect(api.simulateSeason).toHaveBeenNthCalledWith(1, "w1", "s1", { throughMatchday: 2 });

    getByRole("button", { name: /stick with your xi/i }).click();
    expect(api.resolveJanuaryGamble).not.toHaveBeenCalled();

    // A second, uncapped simulate call finishes the back half — the pipeline then continues
    // exactly as the non-January flow does (domestic-standings, team-stats, then stats hub since
    // europeanNights is off here).
    await waitFor(() => expect(api.simulateSeason).toHaveBeenCalledTimes(2), { timeout: 5000 });

    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();
    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000 });
  }, 20000);

  it("never pauses when the world's januaryWindow setting is off", async () => {
    setupJanuary(false);

    const { getByRole, findByRole, queryByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();
    await findByRole("button", { name: /^continue/i }, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000 });
    expect(api.simulateSeason).toHaveBeenCalledTimes(1);
    expect(api.simulateSeason).toHaveBeenCalledWith("w1", "s1");
    expect(queryByText(/halfway there/i)).toBeNull();
  }, 15000);
});

describe("SeasonPage — Phase 4 stats-hub additions render from real data", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the season narrative and manager stat card once squad/manager data comes back", async () => {
    setup();
    api.getEuropeStatus.mockResolvedValue({ qualified: false, position: 12, qualifierCount: 8, ties: [] });
    api.getSummary.mockResolvedValue({
      standings,
      userClub: { id: "user-club", name: "Our XI" },
      userRow: standings.rows[0],
      position: 1,
      unbeaten: false,
      squadOverall: 82,
      squad: [
        { position: "GK", overall: 80 },
        { position: "CB", overall: 78 },
        { position: "ST", overall: 88 },
      ],
    });
    api.getManagerStats.mockResolvedValue({
      manager: { name: "Pep Testola", nationality: "Spain", philosophy: "Fluid possession, intense counter-press" },
      cleanSheets: 10,
      longestWinStreak: 5,
      biggestWin: { opponentClubId: "ai-club", ourScore: 4, theirScore: 0, margin: 4 },
      highestScoringMatch: { opponentClubId: "ai-club", ourScore: 3, theirScore: 3, total: 6 },
    });

    const { getByRole, findByText, findAllByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await findByText(/season story/i, {}, { timeout: 5000 });
    expect(await findByText(/pep testola/i)).toBeTruthy();
    expect(await findByText(/clean sheets/i)).toBeTruthy();
    // "Elite" legitimately appears more than once (the squad-tier badge, the composition
    // sentence, and the Attack unit chip) — assert at least one match rather than a single one.
    expect((await findAllByText(/galácticos|elite/i)).length).toBeGreaterThan(0);
  }, 15000);
});

describe("SeasonPage — Phase 5 finalize-run wiring", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls finalizeRun once the stats hub is reached and shows unlocked trophies", async () => {
    setup();
    api.getEuropeStatus.mockResolvedValue({ qualified: false, position: 12, qualifierCount: 8, ties: [] });
    api.getSummary.mockResolvedValue({ standings, unbeaten: false });
    api.finalizeRun.mockResolvedValue({
      trophies: ["champions", "golden-boot"],
      awards: [],
      records: [],
    });

    const { getByRole, findByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await waitFor(() => expect(api.finalizeRun).toHaveBeenCalledWith("w1", "s1"), { timeout: 5000 });
    expect(await findByText("Champions")).toBeTruthy();
    expect(await findByText("Golden Boot")).toBeTruthy();
  }, 15000);

  it("shows the guest-persistence prompt for a guest user", async () => {
    setup();
    useAuthMock.mockReturnValue({ user: { id: "u1", email: null, displayName: "Guest123", isGuest: true }, isAuthenticated: true });
    api.getEuropeStatus.mockResolvedValue({ qualified: false, position: 12, qualifierCount: 8, ties: [] });
    api.getSummary.mockResolvedValue({ standings, unbeaten: false });

    const { getByRole, findByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    expect(await findByText(/don't lose this season/i)).toBeTruthy();
  }, 15000);

  it("does not show the guest-persistence prompt for a signed-up user (the default fixture)", async () => {
    setup();
    api.getEuropeStatus.mockResolvedValue({ qualified: false, position: 12, qualifierCount: 8, ties: [] });
    api.getSummary.mockResolvedValue({ standings, unbeaten: false });

    const { getByRole, findByText, queryByText } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000 });
    expect(queryByText(/don't lose this season/i)).toBeNull();
  }, 15000);
});
