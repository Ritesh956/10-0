import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DailyArchiveRowDto } from "../api/types";

const api = vi.hoisted(() => ({ getDailyArchive: vi.fn(), getMyDailyArchive: vi.fn() }));
vi.mock("../api/client", () => ({ api }));
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("../lib/auth-context", () => ({ useAuth: useAuthMock }));

import { DailyArchivePage } from "./DailyArchivePage";

afterEach(() => {
  vi.clearAllMocks();
});

function row(overrides: Partial<DailyArchiveRowDto>): DailyArchiveRowDto {
  return {
    id: "d1",
    date: "2026-07-14",
    theme: "nationality",
    themeLabel: "Bastille Day: France",
    fixedFormation: "4-3-3",
    anchorName: "Kylian Mbappé",
    maxScore: 30,
    players: 12,
    topScore: 30,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DailyArchivePage />
    </MemoryRouter>,
  );
}

describe("DailyArchivePage", () => {
  it("lists past dailies linking to their dates, with your score where you played", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    api.getDailyArchive.mockResolvedValue([row({}), row({ id: "d2", date: "2026-07-13", themeLabel: "Nation Spotlight: Poland" })]);
    api.getMyDailyArchive.mockResolvedValue({ d1: { score: 30, maxScore: 30, attemptsUsed: 2 } });
    const { findByText, getByText, getAllByText } = renderPage();

    const bastille = await findByText("Bastille Day: France");
    expect(bastille.closest("a")?.getAttribute("href")).toBe("/daily/2026-07-14");
    expect(await findByText("You: 30/30")).toBeTruthy();
    expect(getByText("Play")).toBeTruthy(); // the one you haven't played
    expect(getAllByText(/anchor Kylian Mbappé · 12 played · top 30\/30/)).toHaveLength(2);
  });

  it("doesn't ask for your scores when signed out", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false });
    api.getDailyArchive.mockResolvedValue([row({})]);
    const { findByText } = renderPage();
    expect(await findByText("Play")).toBeTruthy();
    expect(api.getMyDailyArchive).not.toHaveBeenCalled();
  });
});
