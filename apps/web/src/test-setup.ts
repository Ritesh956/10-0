import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // DraftContext persists the in-progress draft (and worldId) to localStorage — clear it so one
  // test's draft never leaks into the next test's fresh DraftProvider.
  localStorage.clear();
});

// jsdom doesn't implement matchMedia — stub it so prefersReducedMotion() (lib/motion.ts) doesn't
// throw. Defaults to "not reduced"; individual tests can override via window.matchMedia mocking.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
