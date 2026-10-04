import { describe, expect, it } from "vitest";
import { drawShareCard, ordinal, type ShareCardModel } from "./shareImage";
import { europeRun } from "../components/EuropeShareCard";

/** A recording stand-in for CanvasRenderingContext2D — jsdom has no canvas. */
function fakeContext() {
  const texts: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy(
    { texts },
    {
      get(target, prop) {
        if (prop === "texts") return target.texts;
        if (prop === "fillText") return (t: string) => texts.push(t);
        if (prop === "measureText") return (t: string) => ({ width: t.length * 10 });
        if (prop === "createLinearGradient") return () => gradient;
        return () => {};
      },
      set() {
        return true;
      },
    },
  );
  return ctx as unknown as CanvasRenderingContext2D & { texts: string[] };
}

describe("drawShareCard", () => {
  it("draws the kicker, title, headline, every stat and line, and the ribbon", () => {
    const card: ShareCardModel = {
      kicker: "Season result",
      title: "Our XI",
      subtitle: "Premier League · 4-3-3",
      headline: "Champions",
      stats: [
        { label: "Won", value: "28" },
        { label: "Points", value: "91" },
      ],
      lines: ["Overachieved"],
      ribbon: "Unbeaten",
    };
    const ctx = fakeContext();
    drawShareCard(ctx, card);
    for (const t of ["SEASON RESULT", "OUR XI", "Premier League · 4-3-3", "CHAMPIONS", "28", "WON", "91", "Overachieved", "UNBEATEN"]) {
      expect(ctx.texts).toContain(t);
    }
  });
});

describe("share helpers", () => {
  it("formats ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("finds how far the user's club went in Europe", () => {
    const tie = (round: "QF" | "SF" | "FINAL", winner: string) => ({
      id: round, round, homeClubId: "me", awayClubId: "them", firstLegFixtureId: null, secondLegFixtureId: null, winnerClubId: winner, wentToPenalties: false,
    });
    expect(europeRun([tie("QF", "me"), tie("SF", "them")], "me")).toEqual({ round: "SF", won: false });
    expect(europeRun([tie("QF", "me"), tie("SF", "me"), tie("FINAL", "me")], "me")).toEqual({ round: "FINAL", won: true });
    expect(europeRun([], "me")).toBeNull();
  });
});
