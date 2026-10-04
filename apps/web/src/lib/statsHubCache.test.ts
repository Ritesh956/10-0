import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunIndexDto } from "../api/types";

const api = vi.hoisted(() => ({
  getRunIndex: vi.fn(),
  getStandings: vi.fn(async () => ({ rows: [] })),
  getMatchesWithEvents: vi.fn(async (_w: string, seasonId: string) => [{ id: `m-${seasonId}` }]),
  getTeamStats: vi.fn(async () => ({ team: true })),
  getCompetitionStats: vi.fn(async (_w: string, competitionId: string) => ({ competitionId })),
  getManagerStats: vi.fn(async () => null),
  getSummary: vi.fn(async () => ({ summary: true })),
  getLeaguePhaseStandings: vi.fn(async () => ({ rows: ["europe"] })),
  getTeamStatsForCompetition: vi.fn(async () => ({ europeTeam: true })),
  getEuropeBracket: vi.fn(async () => [{ id: "tie" }]),
}));
vi.mock("../api/client", () => ({ api }));

import { loadStatsHubCache, rebuildStatsHub, saveStatsHubCache } from "./statsHubCache";

function index(overrides: Partial<RunIndexDto> = {}): RunIndexDto {
  return {
    domesticSeasonId: "s1",
    domesticCompetitionId: "c1",
    finished: true,
    userClubId: "club",
    europe: null,
    january: null,
    trophies: ["champions"],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("rebuildStatsHub", () => {
  it("returns null for a run that isn't finished", async () => {
    api.getRunIndex.mockResolvedValue(index({ finished: false }));
    expect(await rebuildStatsHub("w")).toBeNull();
    expect(api.getStandings).not.toHaveBeenCalled();
  });

  it("rebuilds a league-only run without touching the Europe endpoints", async () => {
    api.getRunIndex.mockResolvedValue(index());
    const hub = await rebuildStatsHub("w");
    expect(hub).toMatchObject({ qualified: false, allTies: [], europeMatches: [], trophies: ["champions"], domesticSeasonId: "s1" });
    expect(api.getEuropeBracket).not.toHaveBeenCalled();
  });

  it("includes every European stage's matches, the bracket and the champion", async () => {
    api.getRunIndex.mockResolvedValue(
      index({ europe: { competitionId: "eu", leaguePhaseSeasonId: "lp", knockoutSeasonIds: ["qf", "sf", "f"], champion: "club" } }),
    );
    const hub = await rebuildStatsHub("w");
    expect(hub?.qualified).toBe(true);
    expect(hub?.champion).toBe("club");
    expect(hub?.allTies).toEqual([{ id: "tie" }]);
    expect(hub?.europeMatches?.map((m) => m.id)).toEqual(["m-lp", "m-qf", "m-sf", "m-f"]);
    expect(hub?.europeCompetitionStats).toEqual({ competitionId: "eu" });
  });
});

describe("stats hub cache", () => {
  it("round-trips through localStorage", () => {
    saveStatsHubCache("w9", { qualified: false } as never);
    expect(loadStatsHubCache("w9")).toEqual({ qualified: false });
    expect(loadStatsHubCache("missing")).toBeNull();
  });
});
