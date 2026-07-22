import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { WorldHistoryRowDto } from "../api/types";

const api = vi.hoisted(() => ({ getHistory: vi.fn() }));
vi.mock("../api/client", () => ({ api }));

import { HistoryPage } from "./HistoryPage";

afterEach(() => {
  vi.clearAllMocks();
});

function row(overrides: Partial<WorldHistoryRowDto> = {}): WorldHistoryRowDto {
  return {
    worldId: "w1",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "COMPLETED",
    clubName: "Our XI",
    formation: "4-3-3",
    pointsTotal: 95,
    trophies: [],
    ...overrides,
  };
}

describe("HistoryPage", () => {
  it("renders a row per world with its result and formation", async () => {
    api.getHistory.mockResolvedValue([row()]);
    const { findByText } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

    expect(await findByText("Our XI")).toBeTruthy();
    expect(await findByText(/4-3-3/)).toBeTruthy();
    expect(await findByText(/95 pts/)).toBeTruthy();
  });

  it("shows 'In progress' instead of a points total for a run that hasn't been finalized yet", async () => {
    api.getHistory.mockResolvedValue([row({ pointsTotal: null })]);
    const { findByText } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

    expect(await findByText(/in progress/i)).toBeTruthy();
  });

  it("renders unlocked trophies for a world that has them", async () => {
    api.getHistory.mockResolvedValue([row({ trophies: ["champions", "golden-boot"] })]);
    const { findByText } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

    expect(await findByText("Champions")).toBeTruthy();
    expect(await findByText("Golden Boot")).toBeTruthy();
  });

  it("shows an empty-state message with a link to start a draft when there are no runs yet", async () => {
    api.getHistory.mockResolvedValue([]);
    const { findByText, findByRole } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

    expect(await findByText(/no runs yet/i)).toBeTruthy();
    expect(await findByRole("link", { name: /start a draft/i })).toBeTruthy();
  });

  it("shows an error message if the history fetch fails", async () => {
    api.getHistory.mockRejectedValue(new Error("network down"));
    const { findByText } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

    expect(await findByText("network down")).toBeTruthy();
  });
});
