import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { MatchSummaryDto, WorldClubDto } from "../api/types";
import { MatchPopupReel } from "./MatchPopupReel";

const clubs: WorldClubDto[] = [
  { id: "home", name: "Home FC", managedByUserId: "u1", refClubSeasonId: null },
  { id: "away", name: "Away FC", managedByUserId: null, refClubSeasonId: null },
];

function match(fixtureId: string, homeScore: number, awayScore: number, matchday = 1): MatchSummaryDto {
  return {
    fixtureId,
    matchday,
    homeClubId: "home",
    awayClubId: "away",
    homeScore,
    awayScore,
    goals:
      homeScore > 0
        ? [{ minute: 10, clubId: "home", scorerName: "Scorer", assistName: undefined }]
        : [],
  };
}

describe("MatchPopupReel", () => {
  it("cycles through every match and calls onComplete exactly once at the end", async () => {
    const onComplete = vi.fn();
    const matches = [match("f1", 1, 0), match("f2", 2, 2)];
    const { container } = render(
      <MatchPopupReel matches={matches} clubs={clubs} userClubId="home" intervalMs={300} onComplete={onComplete} />,
    );

    expect(container.textContent).toContain("1 / 2");

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 8000, interval: 50 });
  }, 10000);

  it("skip ahead calls onComplete immediately, without waiting for the per-card timer", async () => {
    const onComplete = vi.fn();
    const matches = [match("f1", 3, 0), match("f2", 1, 1), match("f3", 0, 4)];
    const { getByRole } = render(
      <MatchPopupReel matches={matches} clubs={clubs} userClubId="home" intervalMs={5000} onComplete={onComplete} />,
    );

    getByRole("button", { name: /skip ahead/i }).click();

    // onComplete must fire right away — it must NOT still be pending after a short wait,
    // which is what would happen if skip accidentally waited on the 5s per-card timer.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 500, interval: 20 });
  });

  it("calls onComplete immediately for an empty match list", async () => {
    const onComplete = vi.fn();
    render(<MatchPopupReel matches={[]} clubs={clubs} userClubId="home" onComplete={onComplete} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 500, interval: 20 });
  });

  it("accumulates cards newest-first instead of replacing the previous one", async () => {
    const onComplete = vi.fn();
    const matches = [match("f1", 2, 0, 1), match("f2", 0, 1, 2), match("f3", 3, 3, 3)];
    const { container, findByText } = render(
      <MatchPopupReel matches={matches} clubs={clubs} userClubId="home" intervalMs={100} onComplete={onComplete} />,
    );

    // f1 shows immediately (the very first card needs no hold delay).
    expect(container.textContent).toContain("GW1");

    // Once f2 and f3 have also revealed, all three must still be present at once — this is an
    // accumulating feed, not a one-card-at-a-time replacement.
    await findByText("GW3", {}, { timeout: 4000 });
    expect(container.textContent).toContain("GW1");
    expect(container.textContent).toContain("GW2");
    expect(container.textContent).toContain("GW3");

    // Newest-first: GW3's card must appear before GW1's in document order.
    const gw3Index = container.textContent!.indexOf("GW3");
    const gw1Index = container.textContent!.indexOf("GW1");
    expect(gw3Index).toBeLessThan(gw1Index);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 4000 });
  }, 8000);

  it("the running stat strip reflects only the matches revealed so far, from the user's club's perspective", async () => {
    const onComplete = vi.fn();
    // From "home"'s perspective: f1 is a win (2-0), f2 is a loss (0-1 as home means home lost)...
    // — home scores 0, away scores 1, so home lost. f3 is a draw (3-3).
    const matches = [match("f1", 2, 0, 1), match("f2", 0, 1, 2), match("f3", 3, 3, 3)];
    const { findByText, container } = render(
      <MatchPopupReel matches={matches} clubs={clubs} userClubId="home" intervalMs={100} onComplete={onComplete} />,
    );

    await findByText("GW3", {}, { timeout: 4000 });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 4000 });

    // Final tally across all 3: 1 win, 1 draw, 1 loss => 4 points, GF 5, GA 4, GD +1.
    expect(container.textContent).toContain("GF 5");
    expect(container.textContent).toContain("GA 4");
    expect(container.textContent).toContain("GD +1");
  }, 8000);

  it("while streaming, holds without completing even after revealing everything delivered so far", async () => {
    const onComplete = vi.fn();
    // Starts empty (worker hasn't finished a matchday yet) — must show the "kicking off" hint and
    // must NOT fire onComplete, since more results are still coming.
    const { container, rerender } = render(
      <MatchPopupReel matches={[]} clubs={clubs} userClubId="home" intervalMs={50} streaming onComplete={onComplete} />,
    );
    expect(container.textContent).toContain("Kicking off");

    // First matchday lands: reveal it, but still hold (streaming) — no completion.
    rerender(
      <MatchPopupReel matches={[match("f1", 1, 0, 1)]} clubs={clubs} userClubId="home" intervalMs={50} streaming onComplete={onComplete} />,
    );
    await waitFor(() => expect(container.textContent).toContain("GW1"));
    await new Promise((r) => setTimeout(r, 200));
    expect(onComplete).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Results rolling in");
  }, 8000);

  it("finishes once streaming flips off and the last streamed matches have revealed", async () => {
    const onComplete = vi.fn();
    const matches = [match("f1", 1, 0, 1), match("f2", 2, 1, 2)];
    const { rerender } = render(
      <MatchPopupReel matches={matches} clubs={clubs} userClubId="home" intervalMs={50} streaming onComplete={onComplete} />,
    );
    // Still streaming: even after both reveal, it must not complete.
    await new Promise((r) => setTimeout(r, 300));
    expect(onComplete).not.toHaveBeenCalled();

    // Simulation done — driver flips streaming off; now the reel is allowed to finish.
    rerender(
      <MatchPopupReel matches={matches} clubs={clubs} userClubId="home" intervalMs={50} onComplete={onComplete} />,
    );
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 4000, interval: 50 });
  }, 8000);

  it("renders nothing when there is no user club to summarize the feed for", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <MatchPopupReel matches={[match("f1", 1, 0)]} clubs={clubs} userClubId={undefined} onComplete={onComplete} />,
    );
    expect(container.textContent).toBe("");
  });
});
