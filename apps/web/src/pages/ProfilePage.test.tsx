import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CabinetEntryDto, ProfileDto, ProfileRunDto } from "../api/types";

const api = vi.hoisted(() => ({ getProfile: vi.fn() }));
vi.mock("../api/client", () => ({ api }));
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../lib/auth-context", () => ({ useAuth: useAuthMock }));
const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigateMock,
}));

import { ProfilePage } from "./ProfilePage";

afterEach(() => {
  vi.clearAllMocks();
});

function run(overrides: Partial<ProfileRunDto> = {}): ProfileRunDto {
  return {
    worldId: "w1",
    createdAt: "2026-10-04T10:00:00.000Z",
    clubName: "Our XI",
    formation: "4-3-3",
    leagueId: "league-gb1",
    mode: "solo",
    finished: true,
    points: 84,
    position: 1,
    leagueSize: 20,
    won: 26,
    drawn: 6,
    lost: 6,
    goalsFor: 80,
    goalsAgainst: 30,
    squadOverall: 86,
    longestWinStreak: 9,
    trophies: ["champions"],
    ...overrides,
  };
}

function cabinetEntry(overrides: Partial<CabinetEntryDto>): CabinetEntryDto {
  return {
    key: "champions",
    category: "season",
    tier: "common",
    count: 0,
    firstEarnedAt: null,
    lastWorldId: null,
    progress: null,
    rarityPct: 40,
    ...overrides,
  };
}

function profile(overrides: Partial<ProfileDto> = {}): ProfileDto {
  return {
    user: { displayName: "Tester", isGuest: false, memberSince: "2026-10-01T00:00:00.000Z" },
    stats: {
      seasonsStarted: 2,
      seasonsFinished: 1,
      titles: 1,
      topFours: 1,
      invincibles: 0,
      unbeatenSeasons: 0,
      europeanTitles: 0,
      bestPoints: { worldId: "w1", clubName: "Our XI", value: 84 },
      bestRecord: { worldId: "w1", clubName: "Our XI", won: 26, drawn: 6, lost: 6, points: 84 },
      winRate: 26 / 38,
      matchesPlayed: 38,
      goalsScored: 80,
      averageFinish: 1,
      favouriteFormation: "4-3-3",
      favouriteLeagueId: "league-gb1",
      topRatedXi: { worldId: "w1", clubName: "Our XI", value: 86 },
      bestWinStreak: 9,
      trophiesEarned: 1,
    },
    streaks: {
      titles: { current: 1, best: 1 },
      unbeaten: { current: 0, best: 0 },
      onTheUp: { current: 0, best: 0 },
      days: { current: 1, best: 1 },
    },
    cabinet: [
      cabinetEntry({ key: "champions", count: 1, firstEarnedAt: "2026-10-04T10:00:00.000Z", rarityPct: 50 }),
      cabinetEntry({ key: "serial-winner", category: "career", tier: "epic", progress: { current: 1, target: 5 }, rarityPct: 2 }),
      cabinetEntry({ key: "united-nations", category: "squad", tier: "epic", rarityPct: 0 }),
    ],
    daily: { played: 0, perfect: 0, bestScore: 0 },
    runs: [run(), run({ worldId: "w2", finished: false, points: null, position: null, trophies: [] })],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

describe("ProfilePage", () => {
  it("asks a signed-out visitor to start a run instead of calling the API", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, user: null });
    const { findByText } = renderPage();
    expect(await findByText(/start a run/i)).toBeTruthy();
    expect(api.getProfile).not.toHaveBeenCalled();
  });

  it("shows career stats, the cabinet with locked progress, and each run", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, user: { displayName: "Tester", isGuest: false } });
    api.getProfile.mockResolvedValue(profile());
    const { findByText, getByTestId, getByText, getAllByText } = renderPage();

    expect(await findByText("Tester")).toBeTruthy();
    expect(getByText("68%")).toBeTruthy(); // win rate
    expect(getAllByText("26-6-6").length).toBeGreaterThan(0);
    expect(getByTestId("trophy-champions").dataset["earned"]).toBe("true");
    expect(getByTestId("trophy-serial-winner").dataset["earned"]).toBe("false");
    expect(getByText("1 / 5")).toBeTruthy();
    expect(getByText("1st")).toBeTruthy();
    expect(getByText(/in progress/i)).toBeTruthy();
    // The only locked single-run trophy is the weekly highlight.
    expect(getByText(/trophy of the week/i)).toBeTruthy();
  });

  it("filters the cabinet by category", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, user: { displayName: "Tester", isGuest: false } });
    api.getProfile.mockResolvedValue(profile());
    const { findByText, queryByTestId, getByRole } = renderPage();
    await findByText("Tester");

    fireEvent.click(getByRole("button", { name: "Career" }));
    expect(queryByTestId("trophy-serial-winner")).toBeTruthy();
    expect(queryByTestId("trophy-champions")).toBeNull();
  });

  it("links each finished run (not an in-progress one) to its stats hub", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, user: { displayName: "Tester", isGuest: false } });
    api.getProfile.mockResolvedValue(profile());
    const { findAllByText } = renderPage();

    const links = await findAllByText(/view season/i);
    expect(links).toHaveLength(1);
    fireEvent.click(links[0]!);
    expect(navigateMock).toHaveBeenCalledWith("/season?world=w1");
  });
});
