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

const { useRerollSpy } = vi.hoisted(() => ({ useRerollSpy: vi.fn() }));

// A minimal, reactive stand-in for DraftContext — real useState under the hood so addPick
// actually updates picks (unlike a static mock object), starting pre-seeded at "10 of 11
// slots filled, only LB open" to reproduce the reported deadlock scenario directly.
vi.mock("../state/DraftContext", () => ({
  useDraft: () => {
    const [picks, setPicks] = useState<Record<number, PlayerSeasonDto>>(() => {
      const filler = (id: string): PlayerSeasonDto => ({
        id,
        playerId: id,
        clubSeasonId: "prefilled",
        seasonYear: 2020,
        positions: ["CM"],
        overall: 70,
        potential: 70,
        player: { name: id, nationality: "England", photoUrl: null },
        clubSeason: { club: { name: "Prefilled" } },
      });
      // 4-4-2 slots: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST — leave index 1 (LB) open.
      return { 0: filler("gk"), 2: filler("cb1"), 3: filler("cb2"), 4: filler("rb"), 5: filler("lm"), 6: filler("cm1"), 7: filler("cm2"), 8: filler("rm"), 9: filler("st1"), 10: filler("st2") };
    });
    const [rerollsUsed, setRerollsUsed] = useState(0);
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
      rerollsUsed,
      rerollsRemaining: Math.max(0 - rerollsUsed, 0), // the exact reported scenario: zero redraws left
      useReroll: () => {
        useRerollSpy();
        setRerollsUsed((n) => n + 1);
      },
      squadName: "Test XI",
      setSquadName: () => {},
      worldId: null,
      setWorldId: () => {},
    };
  },
}));

import { DraftPage } from "./DraftPage";

const badClub: ClubSeasonDto = {
  id: "bad-club",
  clubId: "bad-club",
  seasonYear: 2020,
  leagueId: "l1",
  reputation: 50,
  club: { id: "bad-club", name: "No Defenders FC", country: "England" },
  league: { id: "l1", name: "Test League" },
};
const goodClub: ClubSeasonDto = {
  id: "good-club",
  clubId: "good-club",
  seasonYear: 2020,
  leagueId: "l1",
  reputation: 50,
  club: { id: "good-club", name: "Has A Defender FC", country: "England" },
  league: { id: "l1", name: "Test League" },
};

function player(id: string, positions: string[]): PlayerSeasonDto {
  return {
    id,
    playerId: id,
    clubSeasonId: id.startsWith("bad") ? "bad-club" : "good-club",
    seasonYear: 2020,
    positions,
    overall: 75,
    potential: 75,
    player: { name: id, nationality: "England", photoUrl: null },
    clubSeason: { club: { name: id.startsWith("bad") ? "No Defenders FC" : "Has A Defender FC" } },
  };
}

describe("DraftPage — auto-reroll avoids the no-eligible-player deadlock", () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    api.listClubSeasons.mockResolvedValue([badClub, goodClub]);
    api.listPlayerSeasons.mockImplementation(async ({ clubSeasonId }: { clubSeasonId: string }) => {
      if (clubSeasonId === "bad-club") {
        // Nobody here can play LB, CB, RB, or LWB — a true dead end for the one open slot.
        return [player("bad-1", ["ST"]), player("bad-2", ["CM"]), player("bad-3", ["CAM"])];
      }
      return [player("good-1", ["CB"]), player("good-2", ["ST"])];
    });
    // Deterministic draw: Math.random() = 0 always picks index 0 of whatever the current
    // (exclusion-filtered) candidate list is — first the bad club, then, once it's excluded
    // by the auto-reroll, the good club.
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("silently redraws past a club with zero eligible players for the last open slot, without spending a redraw", async () => {
    const { getByRole, findByText } = render(
      <MemoryRouter>
        <DraftPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.listClubSeasons).toHaveBeenCalled());
    getByRole("button", { name: /make the draw/i }).click();

    // Should settle on the good club's pool, having transparently skipped the bad one — wait for
    // an actual player from that pool to render (the reel strip shows club names while merely
    // spinning through decorative candidates, so that text alone isn't proof the pool loaded).
    await findByText("good-1", {}, { timeout: 8000 });

    expect(api.listPlayerSeasons).toHaveBeenCalledWith(expect.objectContaining({ clubSeasonId: "bad-club" }));
    expect(api.listPlayerSeasons).toHaveBeenCalledWith(expect.objectContaining({ clubSeasonId: "good-club" }));
    // The whole point: this cost nothing from the user's (zero) redraw budget.
    expect(useRerollSpy).not.toHaveBeenCalled();
  }, 12000);
});
