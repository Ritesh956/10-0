import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { BestXiSlotDto } from "../api/types";

const api = vi.hoisted(() => ({ getBestXi: vi.fn() }));
vi.mock("../api/client", () => ({ api }));
const setConfig = vi.fn();
vi.mock("../state/DraftContext", () => ({ useDraft: () => ({ setConfig }) }));

import { LeagueBestXiPage } from "./LeagueBestXiPage";

afterEach(() => {
  vi.clearAllMocks();
});

const SLOTS = ["GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CAM", "RW", "ST", "LW"];
function slots(): BestXiSlotDto[] {
  return SLOTS.map((slot, i) => ({
    slot,
    pick: {
      playerSeasonId: `ps${i}`,
      playerId: `p${i}`,
      name: i === 9 ? "Romelu Lukaku" : `Player ${i}`,
      nationality: "Italy",
      photoUrl: null,
      clubName: i === 6 ? "Società Sportiva Lazio S.p.A." : "Juventus FC",
      seasonYear: 2020,
      overall: 90,
      position: slot,
    },
    alternatives: i === 9 ? [{ playerSeasonId: "a", playerId: "a", name: "Ciro Immobile", nationality: "Italy", photoUrl: null, clubName: "Lazio", seasonYear: 2019, overall: 92, position: "ST" }] : [],
  }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/best-xi/:league" element={<LeagueBestXiPage />} />
        <Route path="/setup" element={<p>setup page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LeagueBestXiPage", () => {
  it("shows the league's XI with alternatives and everyday club names", async () => {
    api.getBestXi.mockResolvedValue(slots());
    const { findByText, getByText } = renderAt("/best-xi/serie-a");
    expect(await findByText("Romelu Lukaku")).toBeTruthy();
    expect(api.getBestXi).toHaveBeenCalledWith("league-it1");
    expect(getByText(/Ciro Immobile \(92\)/)).toBeTruthy();
    expect(getByText(/^Lazio · 2020\/21$/)).toBeTruthy();
    expect(getByText(/Draft from Serie A/)).toBeTruthy();
  });

  it("starts a draft in that league", async () => {
    api.getBestXi.mockResolvedValue(slots());
    const { findByText, getByText } = renderAt("/best-xi/premier-league");
    fireEvent.click(await findByText(/Draft from the Premier League/));
    expect(setConfig).toHaveBeenCalledWith({ leagueIds: ["league-gb1"] });
    expect(getByText("setup page")).toBeTruthy();
  });

  it("treats an unknown league as not found", () => {
    const { getAllByText } = renderAt("/best-xi/mls");
    expect(getAllByText(/not found|doesn.t exist|404/i).length).toBeGreaterThan(0);
    expect(api.getBestXi).not.toHaveBeenCalled();
  });
});
