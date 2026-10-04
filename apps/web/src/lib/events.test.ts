import { describe, expect, it } from "vitest";
import { timeLeft } from "./events";

describe("timeLeft", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  it("reads days and hours, then hours and minutes, then minutes", () => {
    expect(timeLeft("2026-10-12T00:00:00Z", now)).toBe("5d 12h left");
    expect(timeLeft("2026-10-06T17:30:00Z", now)).toBe("5h 30m left");
    expect(timeLeft("2026-10-06T12:09:00Z", now)).toBe("9m left");
    expect(timeLeft("2026-10-06T12:00:20Z", now)).toBe("1m left");
  });
  it("says Ended once the week is over or the date is bad", () => {
    expect(timeLeft("2026-10-06T12:00:00Z", now)).toBe("Ended");
    expect(timeLeft("nonsense", now)).toBe("Ended");
  });
});
