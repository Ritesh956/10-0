import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { SlotReel } from "./SlotReel";

describe("SlotReel", () => {
  it("shows the decorative pool at rest before any spin has started", () => {
    const { container } = render(
      <SlotReel label="Club" decorativeItems={["Alpha", "Beta"]} winnerLabel={null} spinToken={0} spinning={false} />,
    );
    expect(container.textContent).toContain("Alpha");
  });

  it("spins to the exact pre-decided winner and calls onSettled exactly once", async () => {
    const onSettled = vi.fn();
    const { container } = render(
      <SlotReel
        label="Club"
        decorativeItems={["Alpha", "Beta", "Gamma"]}
        winnerLabel="Winner FC"
        spinToken={1}
        spinning={true}
        onSettled={onSettled}
      />,
    );

    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1), { timeout: 5000, interval: 50 });

    expect(container.textContent).toContain("Winner FC");
  }, 8000);

  it("does not re-fire onSettled if it re-renders with the same spinToken", async () => {
    const onSettled = vi.fn();
    const { rerender } = render(
      <SlotReel
        label="Club"
        decorativeItems={["Alpha", "Beta"]}
        winnerLabel="Winner FC"
        spinToken={1}
        spinning={true}
        onSettled={onSettled}
      />,
    );

    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1), { timeout: 5000, interval: 50 });

    // A re-render with the same token (e.g. an unrelated parent state update) must not restart the spin.
    rerender(
      <SlotReel
        label="Club"
        decorativeItems={["Alpha", "Beta"]}
        winnerLabel="Winner FC"
        spinToken={1}
        spinning={true}
        onSettled={onSettled}
      />,
    );

    await new Promise((r) => setTimeout(r, 200));
    expect(onSettled).toHaveBeenCalledTimes(1);
  }, 8000);

  it("runs a fresh spin and lands on a new winner when spinToken changes (the redraw case)", async () => {
    const onSettled = vi.fn();
    const { container, rerender } = render(
      <SlotReel
        label="Club"
        decorativeItems={["Alpha", "Beta"]}
        winnerLabel="First FC"
        spinToken={1}
        spinning={true}
        onSettled={onSettled}
      />,
    );
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1), { timeout: 5000, interval: 50 });
    expect(container.textContent).toContain("First FC");

    rerender(
      <SlotReel
        label="Club"
        decorativeItems={["Alpha", "Beta"]}
        winnerLabel="Second FC"
        spinToken={2}
        spinning={true}
        onSettled={onSettled}
      />,
    );
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(2), { timeout: 5000, interval: 50 });
    expect(container.textContent).toContain("Second FC");
  }, 12000);
});
