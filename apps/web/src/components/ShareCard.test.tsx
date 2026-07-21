import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { SummaryDto } from "../api/types";

const { fireUnbeatenBurst, fireTitleBurst } = vi.hoisted(() => ({
  fireUnbeatenBurst: vi.fn(),
  fireTitleBurst: vi.fn(),
}));
vi.mock("../lib/confetti", () => ({ fireUnbeatenBurst, fireTitleBurst }));

import { ShareCard } from "./ShareCard";

const standingsRow = { clubId: "user", played: 38, won: 20, drawn: 10, lost: 8, goalsFor: 60, goalsAgainst: 40, points: 70 };

function summary(overrides: Partial<SummaryDto>): SummaryDto {
  return {
    standings: { rows: [standingsRow] },
    userClub: { id: "user", name: "Our XI" },
    userRow: standingsRow,
    position: 5,
    unbeaten: false,
    ...overrides,
  };
}

describe("ShareCard confetti wiring", () => {
  afterEach(() => {
    fireUnbeatenBurst.mockClear();
    fireTitleBurst.mockClear();
  });

  it("fires the unbeaten burst (not the title burst) when unbeaten is true", () => {
    render(<ShareCard summary={summary({ unbeaten: true, position: 1 })} />);
    expect(fireUnbeatenBurst).toHaveBeenCalledTimes(1);
    expect(fireTitleBurst).not.toHaveBeenCalled();
  });

  it("fires the title burst when position is 1 but not unbeaten", () => {
    render(<ShareCard summary={summary({ unbeaten: false, position: 1 })} />);
    expect(fireTitleBurst).toHaveBeenCalledTimes(1);
    expect(fireUnbeatenBurst).not.toHaveBeenCalled();
  });

  it("fires no confetti for a mid-table, non-unbeaten finish", () => {
    render(<ShareCard summary={summary({ unbeaten: false, position: 8 })} />);
    expect(fireUnbeatenBurst).not.toHaveBeenCalled();
    expect(fireTitleBurst).not.toHaveBeenCalled();
  });

  it("renders nothing and fires no confetti when userClub/userRow are missing", () => {
    const { container } = render(
      <ShareCard summary={summary({ userClub: undefined, userRow: undefined, unbeaten: true })} />,
    );
    expect(container.firstChild).toBeNull();
    expect(fireUnbeatenBurst).not.toHaveBeenCalled();
  });
});
