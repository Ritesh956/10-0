import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { MatchSummaryDto, WorldClubDto } from "../api/types";
import { MatchPopupReel } from "./MatchPopupReel";

const clubs: WorldClubDto[] = [
  { id: "home", name: "Home FC", managedByUserId: null, refClubSeasonId: null },
  { id: "away", name: "Away FC", managedByUserId: null, refClubSeasonId: null },
];

function match(fixtureId: string, homeScore: number, awayScore: number): MatchSummaryDto {
  return {
    fixtureId,
    matchday: 1,
    homeClubId: "home",
    awayClubId: "away",
    homeScore,
    awayScore,
    goals:
      homeScore + awayScore > 0
        ? [{ minute: 10, clubId: "home", scorerName: "Scorer", assistName: undefined }]
        : [],
  };
}

describe("MatchPopupReel", () => {
  it("cycles through every match and calls onComplete exactly once at the end", async () => {
    const onComplete = vi.fn();
    const matches = [match("f1", 1, 0), match("f2", 2, 2)];
    const { container } = render(
      <MatchPopupReel matches={matches} clubs={clubs} intervalMs={300} onComplete={onComplete} />,
    );

    expect(container.textContent).toContain("1 / 2");

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 8000, interval: 50 });
  }, 10000);

  it("skip ahead calls onComplete immediately, without waiting for the per-card timer", async () => {
    const onComplete = vi.fn();
    const matches = [match("f1", 3, 0), match("f2", 1, 1), match("f3", 0, 4)];
    const { getByRole } = render(
      <MatchPopupReel matches={matches} clubs={clubs} intervalMs={5000} onComplete={onComplete} />,
    );

    getByRole("button", { name: /skip ahead/i }).click();

    // onComplete must fire right away — it must NOT still be pending after a short wait,
    // which is what would happen if skip accidentally waited on the 5s per-card timer.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 500, interval: 20 });
  });

  it("calls onComplete immediately for an empty match list (nothing for AnimatePresence to exit)", async () => {
    const onComplete = vi.fn();
    render(<MatchPopupReel matches={[]} clubs={clubs} onComplete={onComplete} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 500, interval: 20 });
  });
});
