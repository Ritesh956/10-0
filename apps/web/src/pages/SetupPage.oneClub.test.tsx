import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DraftConfig } from "../state/DraftContext";

const api = vi.hoisted(() => ({
  listEras: vi.fn(),
  listLeagues: vi.fn(),
  getClubPositionCoverage: vi.fn(),
}));
vi.mock("../api/client", () => ({ api }));

const { useDraftMock } = vi.hoisted(() => ({ useDraftMock: vi.fn() }));
vi.mock("../state/DraftContext", async () => {
  const actual = await vi.importActual<typeof import("../state/DraftContext")>("../state/DraftContext");
  return { ...actual, useDraft: useDraftMock };
});

import { SetupPage } from "./SetupPage";

afterEach(() => {
  vi.clearAllMocks();
});

const LOCKED_CONFIG: DraftConfig = {
  eraId: "era-all-time",
  leagueIds: ["league-gb1"],
  formation: "4-3-3",
  difficulty: "normal",
  showRatings: true,
  draftMode: "squad-first",
  playerRatings: "season",
  eraYearMin: 1992,
  eraYearMax: 2025,
  managers: true,
  europeanNights: true,
  januaryWindow: true,
  lockedClubId: "club-1",
  lockedClubName: "AFC Bournemouth",
};

function setup(config: DraftConfig) {
  useDraftMock.mockReturnValue({ config, setConfig: vi.fn(), resetDraft: vi.fn() });
  api.listEras.mockResolvedValue([{ id: "era-all-time", name: "All-Time", startYear: 1992, endYear: 2025 }]);
  api.listLeagues.mockResolvedValue([]);
}

// A 4-3-3 XI needs GK/LB/CB/RB/CDM/CM/LW/ST/RW (see lib/formations.ts's FORMATION_POSITIONS).
const FULL_COVERAGE = ["GK", "LB", "CB", "RB", "CDM", "CM", "LW", "ST", "RW"];
const MISSING_GK = ["LB", "CB", "RB", "CDM", "CM", "LW", "ST", "RW"];

describe("SetupPage — One-Club XI adaptation (Phase 7)", () => {
  it("shows the One-Club banner and hides League/Player Ratings when a club is locked", async () => {
    setup(LOCKED_CONFIG);
    api.getClubPositionCoverage.mockResolvedValue(FULL_COVERAGE);

    const { findByText, getByText, queryByText, queryByRole } = render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(await findByText("AFC Bournemouth")).toBeTruthy();
    expect(getByText(/draft a full league instead/i)).toBeTruthy();
    // League section (LeaguePicker) never rendered while locked — its own empty-state text would
    // otherwise show since the mocked listLeagues() resolves to [].
    expect(queryByText(/no leagues available/i)).toBeNull();
    // Player Ratings is replaced with a forced-Season note, not the Season/Prime toggle.
    expect(getByText(/forced to/i)).toBeTruthy();
    expect(queryByRole("button", { name: /^prime$/i })).toBeNull();
  });

  it("renders the normal League and Player Ratings sections when no club is locked", async () => {
    const unlocked: DraftConfig = { ...LOCKED_CONFIG, lockedClubId: undefined, lockedClubName: undefined };
    setup(unlocked);

    const { findByText, queryByText } = render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(await findByText(/no leagues available/i)).toBeTruthy();
    expect(queryByText(/forced to/i)).toBeNull();
    expect(queryByText(/draft a full league instead/i)).toBeNull();
  });

  it("enables the CTA when the club's recorded history can fill the chosen formation", async () => {
    setup(LOCKED_CONFIG);
    api.getClubPositionCoverage.mockResolvedValue(FULL_COVERAGE);

    const { findByRole } = render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    const cta = await findByRole("button", { name: /enter the draft room/i });
    await waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(false));
  });

  it("disables the CTA and warns when the club's history has nobody for a required slot", async () => {
    setup(LOCKED_CONFIG);
    api.getClubPositionCoverage.mockResolvedValue(MISSING_GK);

    const { findByRole, findByText } = render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(await findByText(/nobody who can play goalkeeper/i)).toBeTruthy();
    const cta = await findByRole("button", { name: /enter the draft room/i });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });
});
