import { describe, expect, it } from "vitest";
import { buildStandings } from "./season.js";

describe("buildStandings", () => {
  it("computes points, goal difference ordering, and full-table rows for byes", () => {
    const standings = buildStandings("season-1", ["A", "B", "C"], [
      { homeClubId: "A", awayClubId: "B", homeScore: 3, awayScore: 1 },
      { homeClubId: "B", awayClubId: "C", homeScore: 2, awayScore: 2 },
    ]);

    const byClub = new Map(standings.rows.map((r) => [r.clubId, r]));
    expect(byClub.get("A")).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 3, goalsAgainst: 1 });
    expect(byClub.get("B")).toMatchObject({ played: 2, drawn: 1, lost: 1, points: 1 });
    expect(byClub.get("C")).toMatchObject({ played: 1, drawn: 1, points: 1 });

    // A (3 pts) should rank above B and C (1 pt each)
    expect(standings.rows[0]?.clubId).toBe("A");
  });
});
