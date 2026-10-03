import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EuropeDrawDto, FixtureDto, StandingsDto, WorldClubDto } from "../api/types";
import { zoneForPosition, ZONE_LEGEND } from "../lib/europe";
import { EuropeDraw } from "./EuropeDraw";
import { StandingsTable } from "./StandingsTable";

const clubs: WorldClubDto[] = [
  { id: "me", name: "Our XI", managedByUserId: "u1", refClubSeasonId: null, country: "England" },
  { id: "a", name: "Real Madrid", managedByUserId: null, refClubSeasonId: "r1", country: "Spain" },
  { id: "b", name: "Bayern Munich", managedByUserId: null, refClubSeasonId: "r2", country: "Germany" },
  { id: "c", name: "Inter", managedByUserId: null, refClubSeasonId: "r3", country: "Italy" },
];

const draw: EuropeDrawDto = {
  clubs: [
    { clubId: "me", name: "Our XI", country: "England", seed: 1, pot: 1, strength: 91 },
    { clubId: "a", name: "Real Madrid", country: "Spain", seed: 2, pot: 2, strength: 88 },
    { clubId: "b", name: "Bayern Munich", country: "Germany", seed: 3, pot: 3, strength: 86 },
    { clubId: "c", name: "Inter", country: "Italy", seed: 4, pot: 4, strength: 84 },
  ],
};

const fixtures: FixtureDto[] = [
  { id: "f1", matchday: 2, homeClubId: "b", awayClubId: "me", status: "SCHEDULED", matchId: null },
  { id: "f2", matchday: 1, homeClubId: "me", awayClubId: "a", status: "SCHEDULED", matchId: null },
];

describe("EuropeDraw", () => {
  it("shows the four pots and lists the user's opponents in matchday order with H/A and pot", () => {
    render(<EuropeDraw draw={draw} clubs={clubs} userClubId="me" fixtures={fixtures} onContinue={() => {}} />);

    for (const pot of [1, 2, 3, 4]) expect(screen.getAllByText(`Pot ${pot}`).length).toBeGreaterThan(0);
    expect(screen.getByText("(You)")).toBeTruthy();

    const items = screen.getByText("Your league phase").parentElement!.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toMatch(/H.*Real Madrid.*Pot 2/);
    expect(items[1]!.textContent).toMatch(/A.*Bayern Munich.*Pot 3/);
  });

  it("calls onContinue from the Play button", () => {
    const onContinue = vi.fn();
    render(<EuropeDraw draw={draw} clubs={clubs} userClubId="me" fixtures={fixtures} onContinue={onContinue} />);
    screen.getByRole("button", { name: /play the league phase/i }).click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("StandingsTable qualification zones", () => {
  const row = (clubId: string, points: number) => ({ clubId, played: 8, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points });
  const ids = Array.from({ length: 36 }, (_, i) => `x${i + 1}`);
  const standings: StandingsDto = { seasonId: "s", rows: ids.map((id, i) => row(id, 36 - i)) };
  const named: WorldClubDto[] = ids.map((id) => ({ id, name: `Club ${id}`, managedByUserId: null, refClubSeasonId: null, country: "France" }));

  it("paints rows 1-8 / 9-24 / 25-36 and shows the legend", () => {
    const { container } = render(
      <StandingsTable standings={standings} clubs={named} zoneFor={zoneForPosition} legend={ZONE_LEGEND} showFlags />,
    );
    const rows = container.querySelectorAll("tbody tr");
    const edge = (n: number) => rows[n - 1]!.querySelector("td")!.className;
    expect(edge(1)).toMatch(/border-l-mint-400/);
    expect(edge(8)).toMatch(/border-l-mint-400/);
    expect(edge(9)).toMatch(/border-l-amber-400/);
    expect(edge(24)).toMatch(/border-l-amber-400/);
    expect(edge(25)).toMatch(/border-l-crimson/);
    expect(screen.getByText(/Round of 16 \(1–8\)/)).toBeTruthy();
    // one flag per row
    expect(container.querySelectorAll("tbody svg")).toHaveLength(36);
  });

  it("is unchanged without zones", () => {
    const { container } = render(<StandingsTable standings={standings} clubs={named} />);
    expect(container.querySelector("tbody td")!.className).not.toMatch(/border-l-4/);
    expect(container.querySelectorAll("tbody svg")).toHaveLength(0);
  });
});
