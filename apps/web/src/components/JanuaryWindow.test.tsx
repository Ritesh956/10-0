import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { JanuaryResultDto, MatchSummaryDto } from "../api/types";
import { JanuaryWindow } from "./JanuaryWindow";

function match(fixtureId: string, homeScore: number, awayScore: number, matchday: number): MatchSummaryDto {
  return { fixtureId, matchday, homeClubId: "home", awayClubId: "away", homeScore, awayScore, goals: [] };
}

const result: JanuaryResultDto = {
  eventType: "POSITIVE",
  outPlayer: { id: "out1", name: "Old Winger", overall: 60, position: "RW" },
  inPlayer: { id: "in1", name: "New Winger", overall: 75, position: "RW", clubName: "Some Club", seasonYear: 2019 },
  delta: 15,
};

describe("JanuaryWindow", () => {
  it("renders the halfway recap (W/D/L/Pts) and the on-pace projection from the first-half matches", () => {
    // From "home"'s perspective: f1 is a win (2-0), f2 a draw (1-1), f3 a loss (0-3) => 1W 1D 1L, 4 pts.
    const matches = [match("f1", 2, 0, 1), match("f2", 1, 1, 2), match("f3", 0, 3, 3)];
    const { container } = render(
      <JanuaryWindow
        matches={matches}
        userClubId="home"
        totalMatchdays={6}
        matchdaysPlayed={3}
        onResolve={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(container.textContent).toContain("Halfway there");
    // 4 points over 3 played, projected across 6 total => round(4/3*6) = 8.
    expect(container.textContent).toContain("8 points");
  });

  it("declining resumes the season immediately without ever calling onResolve", () => {
    const onResolve = vi.fn();
    const onDone = vi.fn();
    const { getByRole } = render(
      <JanuaryWindow matches={[]} userClubId="home" totalMatchdays={6} matchdaysPlayed={3} onResolve={onResolve} onDone={onDone} />,
    );

    getByRole("button", { name: /stick with your xi/i }).click();

    expect(onDone).toHaveBeenCalledWith(null);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("gambling calls onResolve, spins to the resolved player, and shows the OUT→IN diff; Continue hands the result back", async () => {
    const onResolve = vi.fn().mockResolvedValue(result);
    const onDone = vi.fn();
    const { getByRole, findByText, container } = render(
      <JanuaryWindow matches={[]} userClubId="home" totalMatchdays={6} matchdaysPlayed={3} onResolve={onResolve} onDone={onDone} />,
    );

    getByRole("button", { name: /enter the transfer market/i }).click();
    expect(onResolve).toHaveBeenCalledTimes(1);

    // The reel spins for real (matches DrawReel/SlotReel's own test conventions) before settling.
    await findByText(/done deal/i, {}, { timeout: 6000 });
    expect(container.textContent).toContain("Old Winger");
    expect(container.textContent).toContain("New Winger");
    expect(container.textContent).toContain("+15 OVR");

    getByRole("button", { name: /continue the season/i }).click();
    expect(onDone).toHaveBeenCalledWith(result);
  }, 8000);

  it("shows an error and returns to the choice if onResolve rejects, letting the user retry or stick", async () => {
    const onResolve = vi.fn().mockRejectedValue(new Error("No eligible replacement players found"));
    const onDone = vi.fn();
    const { getByRole, findByText } = render(
      <JanuaryWindow matches={[]} userClubId="home" totalMatchdays={6} matchdaysPlayed={3} onResolve={onResolve} onDone={onDone} />,
    );

    getByRole("button", { name: /enter the transfer market/i }).click();

    await findByText(/no eligible replacement players found/i, {}, { timeout: 4000 });
    // Choice buttons must still be usable — a failed gamble isn't a dead end.
    expect(getByRole("button", { name: /enter the transfer market/i })).toBeTruthy();
    expect(getByRole("button", { name: /stick with your xi/i })).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});
