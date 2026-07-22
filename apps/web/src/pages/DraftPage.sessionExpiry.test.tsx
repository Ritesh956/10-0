import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import type { PlayerSeasonDto } from "../api/types";

const api = vi.hoisted(() => ({
  listClubSeasons: vi.fn(),
  listPlayerSeasons: vi.fn(),
  listManagers: vi.fn(),
  createWorld: vi.fn(),
  draftFantasy: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock("../api/client", () => ({ api, ApiError: api.ApiError }));

const { logoutSpy, playAsGuestSpy } = vi.hoisted(() => ({
  logoutSpy: vi.fn(),
  playAsGuestSpy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "u1", displayName: "Rit", isGuest: false },
    logout: logoutSpy,
    playAsGuest: playAsGuestSpy,
  }),
}));

// Same reactive-stand-in pattern as DraftPage.deadlock.test.tsx — a full, already-filled 4-4-2
// XI (GK/LB/CB/CB/RB/LM/CM/CM/RM/ST/ST), managers off so "Continue" goes straight from the
// review step to the pre-season/confirm step without an extra manager-draw screen in the way.
vi.mock("../state/DraftContext", () => ({
  useDraft: () => {
    const [picks] = useState<Record<number, PlayerSeasonDto>>(() => {
      const filler = (id: string, position: string): PlayerSeasonDto => ({
        id,
        playerId: id,
        clubSeasonId: "prefilled",
        seasonYear: 2020,
        positions: [position],
        overall: 75,
        potential: 75,
        player: { name: id, nationality: "England", photoUrl: null },
        clubSeason: { club: { name: "Prefilled" } },
      });
      return {
        0: filler("gk", "GK"),
        1: filler("lb", "LB"),
        2: filler("cb1", "CB"),
        3: filler("cb2", "CB"),
        4: filler("rb", "RB"),
        5: filler("lm", "LM"),
        6: filler("cm1", "CM"),
        7: filler("cm2", "CM"),
        8: filler("rm", "RM"),
        9: filler("st1", "ST"),
        10: filler("st2", "ST"),
      };
    });
    return {
      config: {
        eraId: "era1",
        leagueIds: [],
        formation: "4-4-2" as const,
        difficulty: "easy" as const,
        showRatings: true,
        draftMode: "squad-first" as const,
        playerRatings: "season" as const,
        managers: false,
        europeanNights: false,
        januaryWindow: false,
      },
      setConfig: () => {},
      resetConfig: () => {},
      picks,
      addPick: () => {},
      removePick: () => {},
      resetDraft: () => {},
      rerollsUsed: 0,
      rerollsRemaining: 0,
      useReroll: () => {},
      squadName: "Test XI",
      setSquadName: () => {},
      worldId: null,
      setWorldId: () => {},
    };
  },
}));

import { DraftPage } from "./DraftPage";

describe("DraftPage — recovers from a stale-but-present session (401 on confirm)", () => {
  beforeEach(() => {
    api.listClubSeasons.mockResolvedValue([]);
    api.listPlayerSeasons.mockResolvedValue([]);
    // First confirm attempt fails as the server would for an expired 24h token even though
    // isAuthenticated (a purely local check) reported true — see CLAUDE.md's JWT-expiry gotcha.
    api.createWorld.mockRejectedValueOnce(new api.ApiError("Unauthorized", 401)).mockResolvedValueOnce({
      id: "world-1",
    });
    api.draftFantasy.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("clears the stale session, offers re-auth, and retries the confirm once resolved", async () => {
    const { getByRole, findByText, getByPlaceholderText } = render(
      <MemoryRouter>
        <DraftPage />
      </MemoryRouter>,
    );

    getByRole("button", { name: /^continue/i }).click();
    const confirmButton = await findByText(/simulate season/i);
    confirmButton.click();

    // The raw "Unauthorized" never reaches the user — instead the stale session is cleared and
    // the guest gate reopens with session-expiry-specific copy (not the generic "one more thing").
    expect(await findByText(/your session expired/i)).toBeTruthy();
    await waitFor(() => expect(logoutSpy).toHaveBeenCalled());
    expect(await findByText(/sign in instead/i)).toBeTruthy();

    // Recovering as a fresh guest re-fires the exact same confirm that just failed.
    const nameInput = getByPlaceholderText(/goalmachine/i);
    (nameInput as HTMLInputElement).value = "NewGuest";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    getByRole("button", { name: /^continue$/i }).click();

    await waitFor(() => expect(playAsGuestSpy).toHaveBeenCalled());
    await waitFor(() => expect(api.createWorld).toHaveBeenCalledTimes(2));
    expect(api.draftFantasy).toHaveBeenCalledWith("world-1", "Test XI", "4-4-2", expect.any(Array), undefined);
  }, 12000);
});
