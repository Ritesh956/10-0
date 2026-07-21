import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { StandingsTable } from "./StandingsTable";
import { TeamStatsPanel } from "./TeamStatsPanel";
import { KnockoutBracket } from "./KnockoutBracket";

const clubs = [
  { id: "a", name: "Club A", managedByUserId: "u1", refClubSeasonId: null },
  { id: "b", name: "Club B", managedByUserId: null, refClubSeasonId: null },
];

describe("staggered reveals render every row and settle to full opacity", () => {
  it("StandingsTable", async () => {
    const standings = {
      rows: [
        { clubId: "a", played: 10, won: 8, drawn: 1, lost: 1, goalsFor: 20, goalsAgainst: 5, points: 25 },
        { clubId: "b", played: 10, won: 5, drawn: 2, lost: 3, goalsFor: 15, goalsAgainst: 12, points: 17 },
      ],
    };
    const { container, getByText } = render(<StandingsTable standings={standings} clubs={clubs} />);
    expect(getByText("Club A")).toBeTruthy();
    expect(getByText("Club B")).toBeTruthy();
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
    await waitFor(() => {
      rows.forEach((row) => expect(getComputedStyle(row).opacity).toBe("1"));
    }, { timeout: 3000, interval: 50 });
  }, 5000);

  it("TeamStatsPanel", async () => {
    const stats = {
      clubId: "a",
      goalsFor: 20,
      goalsAgainst: 5,
      squad: [
        { playerId: "p1", name: "Player One", matchesPlayed: 10, goals: 5, assists: 2 },
        { playerId: "p2", name: "Player Two", matchesPlayed: 9, goals: 3, assists: 4 },
      ],
    };
    const { container, getByText } = render(<TeamStatsPanel stats={stats} />);
    expect(getByText("Player One")).toBeTruthy();
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
    await waitFor(() => {
      rows.forEach((row) => expect(getComputedStyle(row).opacity).toBe("1"));
    }, { timeout: 3000, interval: 50 });
  }, 5000);

  it("KnockoutBracket", async () => {
    const ties = [
      {
        id: "t1",
        round: "QF" as const,
        homeClubId: "a",
        awayClubId: "b",
        firstLegFixtureId: null,
        secondLegFixtureId: null,
        winnerClubId: "a",
        wentToPenalties: false,
      },
    ];
    const { container, getByText } = render(<KnockoutBracket ties={ties} clubs={clubs} />);
    expect(getByText("Club A")).toBeTruthy();
    const tieRows = container.querySelectorAll(".notch-sm.flex");
    expect(tieRows.length).toBe(1);
    await waitFor(() => {
      tieRows.forEach((row) => expect(getComputedStyle(row).opacity).toBe("1"));
    }, { timeout: 3000, interval: 50 });
  }, 5000);
});
