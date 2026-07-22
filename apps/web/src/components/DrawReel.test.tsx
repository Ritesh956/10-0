import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { DrawReel } from "./DrawReel";

describe("DrawReel", () => {
  it("fires onSettled exactly once after BOTH the club and season columns land, and shows the winner", async () => {
    const onSettled = vi.fn();
    const { container } = render(
      <DrawReel
        target={{ club: "Winner FC", year: 2020 }}
        spinToken={1}
        spinning={true}
        candidates={[
          { club: "A", year: 2019 },
          { club: "B", year: 2018 },
          { club: "C", year: 2017 },
        ]}
        onSpin={() => {}}
        onSettled={onSettled}
      />,
    );

    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1), { timeout: 6000, interval: 50 });

    expect(container.textContent).toContain("Winner FC");
    expect(container.textContent).toContain("2020");
  }, 10000);

  it("shows the idle placeholder and does not call onSettled before a spin starts", () => {
    const onSettled = vi.fn();
    const { container } = render(
      <DrawReel spinToken={0} spinning={false} onSpin={() => {}} onSettled={onSettled} />,
    );
    expect(container.textContent).toContain("SCANNING");
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("clicking Make the Draw calls onSpin", async () => {
    const onSpin = vi.fn();
    const { getByRole } = render(<DrawReel spinToken={0} spinning={false} onSpin={onSpin} />);
    getByRole("button", { name: /make the draw/i }).click();
    expect(onSpin).toHaveBeenCalledTimes(1);
  });

  it("tapping the reel itself (not just the button) also calls onSpin", () => {
    const onSpin = vi.fn();
    const { getByTestId } = render(<DrawReel spinToken={0} spinning={false} onSpin={onSpin} />);
    getByTestId("draw-reel-box").click();
    expect(onSpin).toHaveBeenCalledTimes(1);
  });

  it("does not double-fire onSpin when the Make the Draw button click bubbles up to the reel box", () => {
    const onSpin = vi.fn();
    const { getByRole } = render(<DrawReel spinToken={0} spinning={false} onSpin={onSpin} />);
    getByRole("button", { name: /make the draw/i }).click();
    expect(onSpin).toHaveBeenCalledTimes(1);
  });

  it("tapping the reel while spinning or disabled does not call onSpin", () => {
    const onSpin = vi.fn();
    const { getByTestId, rerender } = render(<DrawReel spinToken={1} spinning={true} onSpin={onSpin} />);
    getByTestId("draw-reel-box").click();
    expect(onSpin).not.toHaveBeenCalled();

    rerender(<DrawReel spinToken={0} spinning={false} disabled onSpin={onSpin} />);
    getByTestId("draw-reel-box").click();
    expect(onSpin).not.toHaveBeenCalled();
  });
});
