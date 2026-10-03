import { describe, expect, it } from "vitest";
import { routeTitle } from "./routeTitles";

describe("routeTitle", () => {
  it("gives every route its own title, keeping the tagline for the landing page", () => {
    expect(routeTitle("/")).toMatch(/Go Unbeaten/);
    expect(routeTitle("/daily")).toBe("Daily Challenge · Futbol");
    expect(routeTitle("/multiplayer/live/abc")).toBe("Live draft · Futbol");
    expect(routeTitle("/multiplayer/league/abc")).toBe("League · Futbol");
    expect(routeTitle("/best-xi/serie-a")).toBe("Greatest Serie A XI · Futbol");
    expect(routeTitle("/best-xi/nope")).toBe("Page not found · Futbol");
    expect(routeTitle("/nope")).toBe("Page not found · Futbol");
  });
});

import { nationFlag } from "./flags";

describe("nationFlag", () => {
  it("builds regional-indicator flags, home-nation subdivision flags, and falls back to empty", () => {
    expect(nationFlag("France")).toBe("🇫🇷");
    expect(nationFlag("Korea, South")).toBe("🇰🇷");
    expect(nationFlag("England")).toBe(""); // drawn as an SVG by CountryFlag instead
    expect(nationFlag("Atlantis")).toBe("");
  });
});
