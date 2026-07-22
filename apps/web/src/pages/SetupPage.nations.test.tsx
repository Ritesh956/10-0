import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
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
  leagueIds: [],
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
  lockedNationality: "Brazil",
};

function setup(config: DraftConfig) {
  useDraftMock.mockReturnValue({ config, setConfig: vi.fn(), resetDraft: vi.fn() });
  api.listEras.mockResolvedValue([{ id: "era-all-time", name: "All-Time", startYear: 1992, endYear: 2025 }]);
  api.listLeagues.mockResolvedValue([]);
}

describe("SetupPage — Nations Trophy adaptation (Phase 10)", () => {
  it("shows the Nation banner and escape hatch, but keeps the normal Season/Prime toggle", async () => {
    setup(LOCKED_CONFIG);

    const { findByText, getByText, queryByText } = render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(await findByText("Brazil")).toBeTruthy();
    expect(getByText(/draft a full league instead/i)).toBeTruthy();
    // Unlike One-Club, a nation's own nationality never changes between a drawn season and a
    // player's career-best one, so Prime stays a real, selectable option here.
    expect(queryByText(/forced to/i)).toBeNull();
    expect(getByText("Prime")).toBeTruthy();
    expect(getByText(/career-best rating/i)).toBeTruthy();
    // League section (LeaguePicker) never rendered while a nation is locked, same as One-Club.
    expect(queryByText(/no leagues available/i)).toBeNull();
  });

  it("never disables the CTA for a locked nation (no per-nation formation feasibility check)", async () => {
    setup(LOCKED_CONFIG);

    const { findByRole } = render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    const cta = await findByRole("button", { name: /enter the draft room/i });
    expect((cta as HTMLButtonElement).disabled).toBe(false);
    expect(api.getClubPositionCoverage).not.toHaveBeenCalled();
  });
});
