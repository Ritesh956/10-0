import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { LeaderboardEntryDto } from "../api/types";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../lib/auth-context", () => ({ useAuth: useAuthMock }));

const api = vi.hoisted(() => ({ getLeaderboard: vi.fn(), listLeagues: vi.fn(), reportLeaderboardEntry: vi.fn() }));
vi.mock("../api/client", () => ({ api }));

import { LeaderboardPage } from "./LeaderboardPage";

afterEach(() => {
  vi.clearAllMocks();
});

function entry(overrides: Partial<LeaderboardEntryDto> = {}): LeaderboardEntryDto {
  return {
    id: "e1",
    worldId: "w1",
    userId: "u1",
    handle: "Alex",
    mode: "solo",
    difficulty: "normal",
    ratingsMode: "season",
    formation: "4-3-3",
    squadOverall: 84,
    clubName: "Our XI",
    leagueName: "Premier League",
    won: 30,
    drawn: 5,
    lost: 3,
    goalDiff: 42,
    points: 95,
    verified: true,
    reportCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setup() {
  useAuthMock.mockReturnValue({ isAuthenticated: true, user: { id: "u1", email: null, displayName: "Tester", isGuest: false } });
  api.listLeagues.mockResolvedValue([]);
  api.getLeaderboard.mockResolvedValue([entry()]);
}

describe("LeaderboardPage", () => {
  it("renders a ranked row with handle, result, and points", async () => {
    setup();
    const { findByText } = render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );

    expect(await findByText("Alex")).toBeTruthy();
    expect(await findByText("30-5-3+42")).toBeTruthy();
    expect(await findByText(/95 PTS/)).toBeTruthy();
  });

  it("shows the app's namesake wins-0 line for a perfect record", async () => {
    setup();
    api.getLeaderboard.mockResolvedValue([entry({ won: 38, drawn: 0, lost: 0, goalDiff: 74 })]);
    const { findByText } = render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );

    expect(await findByText("38-0 ✨")).toBeTruthy();
  });

  it("shows an empty-state message when no runs match the current filters", async () => {
    setup();
    api.getLeaderboard.mockResolvedValue([]);
    const { findByText } = render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );

    expect(await findByText(/no runs match these filters/i)).toBeTruthy();
  });

  it("shows the Friends-tab stub instead of the global list when Friends is selected", async () => {
    setup();
    const { findByRole, findByText, queryByText } = render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );
    await findByText("Alex");

    (await findByRole("button", { name: "Friends" })).click();

    expect(await findByText(/friend graph/i)).toBeTruthy();
    expect(queryByText("Alex")).toBeNull();
  });

  it("shows an error message if the leaderboard fetch fails", async () => {
    setup();
    api.getLeaderboard.mockRejectedValue(new Error("network down"));
    const { findByText } = render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );

    expect(await findByText("network down")).toBeTruthy();
  });
});
