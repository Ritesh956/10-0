import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const verifyMagicLink = vi.fn();
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ verifyMagicLink }) }));

import { MagicLinkPage } from "./MagicLinkPage";

afterEach(() => {
  vi.clearAllMocks();
});

function renderAt(path: string) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/auth/magic" element={<MagicLinkPage />} />
          <Route path="/profile" element={<p>profile page</p>} />
          <Route path="/daily" element={<p>daily page</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe("MagicLinkPage", () => {
  it("spends the single-use link exactly once (even under StrictMode) and goes to `next`", async () => {
    verifyMagicLink.mockResolvedValue(undefined);
    const { findByText } = renderAt("/auth/magic?token=abc123&next=%2Fdaily");
    expect(await findByText("daily page")).toBeTruthy();
    expect(verifyMagicLink).toHaveBeenCalledTimes(1);
    expect(verifyMagicLink).toHaveBeenCalledWith("abc123");
  });

  it("ignores an off-site `next` and lands on the profile", async () => {
    verifyMagicLink.mockResolvedValue(undefined);
    const { findByText } = renderAt("/auth/magic?token=abc123&next=%2F%2Fevil.com");
    expect(await findByText("profile page")).toBeTruthy();
  });

  it("explains an expired link and offers a new one", async () => {
    verifyMagicLink.mockRejectedValue(new Error("This sign-in link has expired or was already used"));
    const { findByText, getByText } = renderAt("/auth/magic?token=old");
    expect(await findByText(/expired or was already used/)).toBeTruthy();
    expect(getByText(/get a new link/i).closest("a")?.getAttribute("href")).toBe("/signin");
  });
});
