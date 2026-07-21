import { afterEach, describe, expect, it, vi } from "vitest";

const { confettiMock } = vi.hoisted(() => ({ confettiMock: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: confettiMock }));

import {
  fireChampionShower,
  fireQualificationBurst,
  fireTitleBurst,
  fireUnbeatenBurst,
} from "./confetti";

const BRAND_COLORS = ["#d69a34", "#e6b559", "#f0cd8a", "#3d8f82", "#5aada0", "#f3ede0"];

function mockReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("confetti presets", () => {
  afterEach(() => {
    confettiMock.mockClear();
    mockReducedMotion(false);
  });

  it("fireQualificationBurst fires once with brand colors", () => {
    fireQualificationBurst();
    expect(confettiMock).toHaveBeenCalledTimes(1);
    expect(confettiMock.mock.calls[0]![0]).toMatchObject({ colors: BRAND_COLORS });
  });

  it("fireUnbeatenBurst fires once with brand colors", () => {
    fireUnbeatenBurst();
    expect(confettiMock).toHaveBeenCalledTimes(1);
    expect(confettiMock.mock.calls[0]![0]).toMatchObject({ colors: BRAND_COLORS });
  });

  it("fireTitleBurst fires once with brand colors", () => {
    fireTitleBurst();
    expect(confettiMock).toHaveBeenCalledTimes(1);
    expect(confettiMock.mock.calls[0]![0]).toMatchObject({ colors: BRAND_COLORS });
  });

  it("fireChampionShower fires multiple bursts, all with brand colors", async () => {
    fireChampionShower();
    // the shower's rAF loop schedules extra bursts asynchronously — let those run.
    await new Promise((r) => setTimeout(r, 50));
    expect(confettiMock.mock.calls.length).toBeGreaterThan(1);
    for (const call of confettiMock.mock.calls) {
      expect(call[0]).toMatchObject({ colors: BRAND_COLORS });
    }
  });

  it("every preset is a no-op when prefers-reduced-motion is set", () => {
    mockReducedMotion(true);
    fireQualificationBurst();
    fireUnbeatenBurst();
    fireTitleBurst();
    fireChampionShower();
    expect(confettiMock).not.toHaveBeenCalled();
  });
});
