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

const api = vi.hoisted(() => ({
  getWorld: vi.fn(),
  createSeason: vi.fn(),
  simulateSeason: vi.fn(),
  getSeason: vi.fn(),
  getMatchesWithEvents: vi.fn(),
  getStandings: vi.fn(),
  getTeamStats: vi.fn(),
  getEuropeStatus: vi.fn(),
  startEuropeLeaguePhase: vi.fn(),
  startEuropeKnockouts: vi.fn(),
  advanceEuropeKnockouts: vi.fn(),
  getLeaguePhaseStandings: vi.fn(),
  getSummary: vi.fn(),
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
  useDraftMock.mockReturnValue({ worldId: "w1" });
  api.getWorld.mockResolvedValue(world);
  api.createSeason.mockResolvedValue(season);
  api.simulateSeason.mockResolvedValue({ status: "ok" });
  api.getSeason.mockResolvedValue(completedSeason);
  api.getMatchesWithEvents.mockResolvedValue([]); // empty on purpose — exercises the fixed empty-list path fast
  api.getStandings.mockResolvedValue(standings);
  api.getTeamStats.mockResolvedValue(teamStats);
}

describe("SeasonPage — qualification confetti wiring", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
    getByRole("button", { name: /create season/i }).click();

    await findByText(/simulate season/i);
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
    getByRole("button", { name: /create season/i }).click();
    await findByText(/simulate season/i);
    getByRole("button", { name: /simulate season/i }).click();

    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();
    await findByText(/continue/i, {}, { timeout: 5000 });
    getByRole("button", { name: /continue/i }).click();

    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000, interval: 50 });
    expect(fireQualificationBurst).not.toHaveBeenCalled();
  }, 15000);
});

describe("SeasonPage — every 'Continue' button through the full knockout gauntlet", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("advances through domestic standings, team stats, Europe transition, league standings, every knockout round result, and the champion screen, via real clicks on every Continue button", async () => {
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

    const { getByRole, findByText, findByRole } = render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getWorld).toHaveBeenCalled());
    getByRole("button", { name: /create season/i }).click();
    await findByText(/simulate season/i);
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

    // europe-league-standings — "Continue to Knockouts"
    await findByRole("button", { name: /continue to knockouts/i }, { timeout: 5000 });
    getByRole("button", { name: /continue to knockouts/i }).click();

    // europe-round-result (QF)
    await findByText(/quarter-final results/i, {}, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    // europe-round-result (SF)
    await findByText(/semi-final results/i, {}, { timeout: 5000 });
    getByRole("button", { name: /^continue/i }).click();

    // europe-champion
    await findByText(/champions league winners/i, {}, { timeout: 15000 });
    getByRole("button", { name: /^continue/i }).click();

    // summary
    await waitFor(() => expect(api.getSummary).toHaveBeenCalled(), { timeout: 5000, interval: 50 });
    await findByText(/season result/i, {}, { timeout: 5000 });
  }, 30000);
});
