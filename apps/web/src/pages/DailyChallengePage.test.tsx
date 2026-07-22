import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ClubSeasonDto, DailyChallengeDto, PlayerSeasonDto } from "../api/types";

const api = vi.hoisted(() => ({
  getDailyChallenge: vi.fn(),
  getDailyLeaderboard: vi.fn(),
  listLeagues: vi.fn(),
  listClubSeasons: vi.fn(),
  listPlayerSeasons: vi.fn(),
  submitDailyAttempt: vi.fn(),
}));
vi.mock("../api/client", () => ({ api }));

vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));

import { DailyChallengePage } from "./DailyChallengePage";

const challenge: DailyChallengeDto = {
  id: "daily-1",
  date: "2026-07-22",
  theme: "nationality",
  themeLabel: "Nation Spotlight: Poland",
  fixedFormation: "4-3-3",
  refreshesAt: new Date(Date.now() + 3600000).toISOString(),
  anchor: {
    id: "anchor-ps",
    playerId: "anchor-player",
    name: "Anchor Player",
    nationality: "Poland",
    overall: 90,
    positions: ["ST"],
    photoUrl: null,
    clubName: "Bayern Munich",
    clubId: "club-bayern",
  },
  constraints: [
    { type: "nationality", value: "Poland", label: "Poland", required: 2, description: "2 other Poland players" },
    { type: "club", value: "club-bayern", label: "Bayern Munich", required: 1, description: "1 other player whose featured season was at Bayern Munich" },
  ],
  poolStats: { totalPlayers: 100, eligiblePerConstraint: [10, 5] },
};

const club: ClubSeasonDto = {
  id: "club-1",
  clubId: "club-1",
  seasonYear: 2020,
  leagueId: "l1",
  reputation: 50,
  club: { id: "club-1", name: "Test FC", country: "England" },
  league: { id: "l1", name: "Test League" },
};

const polishMidfielder: PlayerSeasonDto = {
  id: "polish-cdm",
  playerId: "polish-cdm-player",
  clubSeasonId: "club-1",
  seasonYear: 2020,
  positions: ["CDM"],
  overall: 82,
  potential: 82,
  player: { name: "Polish Anchorman", nationality: "Poland", photoUrl: null },
  clubSeason: { club: { id: "club-1", name: "Test FC" } },
};

describe("DailyChallengePage — anchor pre-seed and live requirements tracking", () => {
  beforeEach(() => {
    api.getDailyChallenge.mockResolvedValue(challenge);
    api.getDailyLeaderboard.mockResolvedValue([]);
    api.listLeagues.mockResolvedValue([{ id: "l1", eraId: "e1", name: "Test League", country: "England", tier: 1 }]);
    api.listClubSeasons.mockResolvedValue([club]);
    api.listPlayerSeasons.mockResolvedValue([polishMidfielder]);
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("pre-seeds the anchor into a compatible pitch slot, then updates the requirements tracker as picks are made", async () => {
    const { getByRole, getAllByRole, findByText, getAllByText } = render(
      <MemoryRouter>
        <DailyChallengePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getDailyChallenge).toHaveBeenCalled());
    await waitFor(() => expect(api.listClubSeasons).toHaveBeenCalled());

    // Anchor is already on the pitch, unpicked — requirements start unmet.
    expect(getAllByText("Anchor Player").length).toBeGreaterThan(0);
    expect(getAllByText("0/2").length).toBeGreaterThan(0);
    expect(getAllByText("0/1").length).toBeGreaterThan(0);

    fireEvent.click(getByRole("button", { name: /make the draw/i }));
    await findByText("Polish Anchorman", {}, { timeout: 8000 });

    fireEvent.click(getByRole("button", { name: /polish anchorman/i }));

    // 4-3-3 minus the anchor leaves 10 open slots (not just one), so the pick doesn't auto-place —
    // it needs a slot click. CDM is the only slot labeled "Defensive" in this formation. fireEvent
    // (not raw .click()) is required here — it flushes the preceding setPendingPlayer synchronously,
    // so this query/click sees the committed state instead of racing a stale pre-click render.
    const cdmSlotButtons = getAllByRole("button").filter((b) => /defensive/i.test(b.textContent ?? ""));
    expect(cdmSlotButtons.length).toBe(1);
    fireEvent.click(cdmSlotButtons[0]!);

    // The newly-placed Polish CDM should count toward the nationality requirement (Polish Anchorman
    // is Polish, same as the anchor) but not the club requirement (different club).
    await waitFor(() => expect(getAllByText("1/2").length).toBeGreaterThan(0));
    expect(getAllByText("0/1").length).toBeGreaterThan(0);
  }, 12000);
});
