import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StandingsDto, WorldClubDto } from "../api/types";
import { MiniTable, tableWindow } from "./MiniTable";

describe("tableWindow", () => {
  const rows = Array.from({ length: 20 }, (_, i) => i + 1);
  it("centres on the club, and keeps a full-size window at the edges", () => {
    expect(tableWindow(rows, 9, 2)).toEqual({ start: 7, rows: [8, 9, 10, 11, 12] });
    expect(tableWindow(rows, 0, 2)).toEqual({ start: 0, rows: [1, 2, 3, 4, 5] });
    expect(tableWindow(rows, 19, 2)).toEqual({ start: 15, rows: [16, 17, 18, 19, 20] });
  });
  it("copes with a short table and a missing club", () => {
    expect(tableWindow([1, 2, 3], 1, 2).rows).toEqual([1, 2, 3]);
    expect(tableWindow(rows, -1, 2).rows).toEqual([]);
  });
});

describe("MiniTable", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
  const clubs: WorldClubDto[] = ids.map((id) => ({ id, name: `Club ${id}`, managedByUserId: id === "c4" ? "u" : null, refClubSeasonId: null }));
  const standings = (played: number): StandingsDto => ({
    seasonId: "s",
    rows: ids.map((clubId, i) => ({ clubId, played, won: 0, drawn: 0, lost: 0, goalsFor: 10 - i, goalsAgainst: 5, points: 30 - i })),
  });

  it("shows you and two rows either side, with your position number", () => {
    const { container, getByText } = render(<MiniTable standings={standings(10)} clubs={clubs} userClubId="c4" />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(5);
    expect(rows[0]!.textContent).toContain("2");
    expect(getByText("(You)")).toBeTruthy();
  });

  it("stays hidden until a match has been played", () => {
    const { container } = render(<MiniTable standings={standings(0)} clubs={clubs} userClubId="c4" />);
    expect(container.innerHTML).toBe("");
  });
});
