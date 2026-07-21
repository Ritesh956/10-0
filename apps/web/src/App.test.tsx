import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Link } from "react-router-dom";

vi.mock("./pages/LandingPage", () => ({
  LandingPage: () => (
    <div>
      <p>LANDING_CONTENT</p>
      <Link to="/setup">Go to setup</Link>
    </div>
  ),
}));
vi.mock("./pages/AuthPage", () => ({ AuthPage: () => <p>AUTH_CONTENT</p> }));
vi.mock("./pages/SetupPage", () => ({ SetupPage: () => <p>SETUP_CONTENT</p> }));
vi.mock("./pages/DraftPage", () => ({ DraftPage: () => <p>DRAFT_CONTENT</p> }));
vi.mock("./pages/SeasonPage", () => ({ SeasonPage: () => <p>SEASON_CONTENT</p> }));
vi.mock("./pages/MultiplayerPage", () => ({ MultiplayerPage: () => <p>MULTIPLAYER_CONTENT</p> }));

import App from "./App";

describe("App — page transition wrapper", () => {
  it("renders the initial route and navigates to a new route via a real Link click", async () => {
    window.history.pushState({}, "", "/");
    const { getByText, findByText } = render(<App />);

    await findByText("LANDING_CONTENT");

    getByText("Go to setup").click();

    // The outgoing page's AnimatePresence exit must actually resolve (jsdom's rAF really
    // ticks, unlike the hidden-tab browser-pane environment), letting the new page mount.
    await waitFor(() => expect(getByText("SETUP_CONTENT")).toBeTruthy(), { timeout: 3000, interval: 50 });
  }, 8000);
});
