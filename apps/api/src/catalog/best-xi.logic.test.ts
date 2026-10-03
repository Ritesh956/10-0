import { describe, expect, it } from "vitest";
import { pickBestXi, type BestXiCandidate } from "./best-xi.logic.js";

let seq = 0;
function c(position: string, overall: number, overrides: Partial<BestXiCandidate> = {}): BestXiCandidate {
  seq++;
  return {
    playerSeasonId: `ps${seq}`,
    playerId: `p${seq}`,
    name: `Player ${seq}`,
    nationality: "England",
    photoUrl: null,
    clubName: "Club",
    seasonYear: 2015,
    overall,
    position,
    ...overrides,
  };
}

describe("pickBestXi", () => {
  it("fills both centre-back slots with different players, best first", () => {
    const xi = pickBestXi([c("CB", 85), c("CB", 92), c("CB", 88), c("CB", 80)]);
    const cbs = xi.filter((s) => s.slot === "CB");
    expect(cbs.map((s) => s.pick?.overall)).toEqual([92, 88]);
    // Alternatives exclude both starters.
    expect(cbs[0]!.alternatives.map((a) => a.overall)).toEqual([85, 80]);
  });

  it("uses a player once, at their best season", () => {
    const xi = pickBestXi([
      c("ST", 90, { playerId: "kane", seasonYear: 2017 }),
      c("ST", 93, { playerId: "kane", seasonYear: 2019 }),
      c("ST", 89, { playerId: "other" }),
    ]);
    const st = xi.find((s) => s.slot === "ST")!;
    expect(st.pick).toMatchObject({ playerId: "kane", seasonYear: 2019 });
    expect(st.alternatives.map((a) => a.playerId)).toEqual(["other"]);
  });

  it("lets RM fill the right wing and CF the striker slot", () => {
    const xi = pickBestXi([c("RM", 84), c("CF", 86)]);
    expect(xi.find((s) => s.slot === "RW")!.pick?.position).toBe("RM");
    expect(xi.find((s) => s.slot === "ST")!.pick?.position).toBe("CF");
  });

  it("leaves a slot empty rather than playing someone out of position", () => {
    const xi = pickBestXi([c("CB", 90)]);
    expect(xi.find((s) => s.slot === "GK")!.pick).toBeNull();
    expect(xi).toHaveLength(11);
  });

  it("caps alternatives at the requested count", () => {
    const xi = pickBestXi([c("GK", 90), c("GK", 89), c("GK", 88), c("GK", 87), c("GK", 86)], 3);
    expect(xi[0]!.alternatives).toHaveLength(3);
  });
});
