import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import type { ClubSeasonDto, PlayerSeasonDto } from "../api/types";

const api = vi.hoisted(() => ({
  listClubSeasons: vi.fn(),
  listPlayerSeasons: vi.fn(),
  listManagers: vi.fn(),
}));
vi.mock("../api/client", () => ({ api }));

vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false }) }));

// A minimal, reactive stand-in for DraftContext — real useState so addPick actually updates
// picks, starting from a genuinely empty XI (unlike DraftPage.deadlock.test.tsx, which
// pre-seeds 10 of 11 slots to reproduce a different scenario).
vi.mock("../state/DraftContext", () => ({
  useDraft: () => {
    const [picks, setPicks] = useState<Record<number, PlayerSeasonDto>>({});
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
      addPick: (slotIndex: number, player: PlayerSeasonDto) => setPicks((prev) => ({ ...prev, [slotIndex]: player })),
      removePick: (slotIndex: number) =>
        setPicks((prev) => {
          const next = { ...prev };
          delete next[slotIndex];
          return next;
        }),
      resetDraft: () => setPicks({}),
      rerollsUsed: 0,
      rerollsRemaining: 3,
      useReroll: () => {},
      squadName: "Test XI",
      setSquadName: () => {},
      worldId: null,
      setWorldId: () => {},
    };
  },
}));

import { DraftPage } from "./DraftPage";

const club: ClubSeasonDto = {
  id: "club-1",
  clubId: "club-1",
  seasonYear: 2020,
  leagueId: "l1",
  reputation: 50,
  club: { id: "club-1", name: "Test FC", country: "England" },
  league: { id: "l1", name: "Test League" },
};

function player(id: string, positions: string[], overall: number): PlayerSeasonDto {
  return {
    id,
    playerId: id,
    clubSeasonId: "club-1",
    seasonYear: 2020,
    positions,
    overall,
    potential: overall,
    player: { name: id, nationality: "England", photoUrl: null },
    clubSeason: { club: { name: "Test FC" } },
  };
}

describe("DraftPage — live squad-ratings panel updates progressively during the draft", () => {
  beforeEach(() => {
    api.listClubSeasons.mockResolvedValue([club]);
    api.listPlayerSeasons.mockResolvedValue([player("striker-1", ["ST"], 88)]);
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows no OVERALL panel before the first pick, then a live per-unit readout after it", async () => {
    const { getByRole, getAllByRole, findByText, queryByText, getAllByText } = render(
      <MemoryRouter>
        <DraftPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.listClubSeasons).toHaveBeenCalled());

    // Nothing drafted yet — the live readout must not render at all (no "Overall 0" misreading).
    expect(queryByText(/^overall$/i)).toBeNull();

    getByRole("button", { name: /make the draw/i }).click();
    await findByText("striker-1", {}, { timeout: 8000 });

    getByRole("button", { name: /striker-1/i }).click();
    // Confirms pendingPlayer state actually landed before we go hunting for a pitch slot to click.
    await findByText(/choose a position for/i);

    // 4-4-2 has two ST slots; click the first empty one to assign the striker into it.
    const stSlotButtons = getAllByRole("button").filter((b) => /striker/i.test(b.textContent ?? ""));
    expect(stSlotButtons.length).toBeGreaterThan(0);
    stSlotButtons[0]!.click();

    // The panel should now be visible after exactly one pick — not gated behind a full XI.
    await waitFor(() => expect(queryByText(/^overall$/i)).not.toBeNull());
    // Attack unit average == the one striker's overall — "88" legitimately also appears
    // elsewhere (e.g. the drafted-player row), so just confirm it rendered at least once here
    // rather than requiring it to be unique on the page.
    expect(getAllByText("88").length).toBeGreaterThanOrEqual(1);
    // Midfield, Defence, and Goalkeeping have no picks yet — each renders the empty placeholder.
    expect(getAllByText("–").length).toBe(3);
  }, 12000);
});
