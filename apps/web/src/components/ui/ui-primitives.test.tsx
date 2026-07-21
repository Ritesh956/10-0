import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Toggle } from "./Toggle";
import { SegmentedControl } from "./SegmentedControl";
import { RatingBar } from "./RatingBar";

describe("motion-wrapped ui primitives still fire their handlers", () => {
  it("Button calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Go</Button>);
    getByRole("button", { name: "Go" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Button respects disabled — no onClick when disabled", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    getByRole("button", { name: "Go" }).click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Chip calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Chip onClick={onClick}>Filter</Chip>);
    getByRole("button", { name: "Filter" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Toggle calls onChange with the flipped value", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="Managers" checked={false} onChange={onChange} />);
    getByRole("button", { name: /managers/i }).click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("SegmentedControl calls onChange with the clicked option's value", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <SegmentedControl
        options={[
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    getByRole("button", { name: /option b/i }).click();
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("RatingBar animates its fill to the target percentage", async () => {
    const { container } = render(<RatingBar label="Attack" value={80} max={100} colorClass="bg-crimson-400" />);
    const fill = container.querySelector(".bg-crimson-400") as HTMLElement;
    expect(fill).toBeTruthy();
    await waitFor(() => expect(fill.style.width).toBe("80%"), { timeout: 3000, interval: 50 });
  }, 5000);
});
