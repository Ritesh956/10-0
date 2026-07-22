import { describe, expect, it } from "vitest";
import { evaluateTrophies, type RunSummary } from "./trophy-evaluation.js";

function run(overrides: Partial<RunSummary> = {}): RunSummary {
  return { userClubId: "us", played: 38, won: 20, drawn: 10, lost: 8, position: 5, ...overrides };
}

describe("evaluateTrophies", () => {
  it("awards Invincible for a perfect record (won every match), not Unbeaten too", () => {
    const trophies = evaluateTrophies(run({ played: 38, won: 38, drawn: 0, lost: 0 }));
    expect(trophies).toContain("invincible");
    expect(trophies).not.toContain("unbeaten");
  });

  it("awards Unbeaten for no losses but at least one draw", () => {
    const trophies = evaluateTrophies(run({ played: 38, won: 30, drawn: 8, lost: 0 }));
    expect(trophies).toContain("unbeaten");
    expect(trophies).not.toContain("invincible");
  });

  it("awards neither Invincible nor Unbeaten once there's a single loss", () => {
    const trophies = evaluateTrophies(run({ played: 38, won: 30, drawn: 7, lost: 1 }));
    expect(trophies).not.toContain("invincible");
    expect(trophies).not.toContain("unbeaten");
  });

  it("never awards an unbeaten-family trophy for a played=0 run", () => {
    expect(evaluateTrophies(run({ played: 0, won: 0, drawn: 0, lost: 0 }))).toEqual([]);
  });

  it("awards Champions only for position 1", () => {
    expect(evaluateTrophies(run({ position: 1 }))).toContain("champions");
    expect(evaluateTrophies(run({ position: 2 }))).not.toContain("champions");
  });

  it("awards Golden Boot/Playmaker/Golden Glove/MVP only when the user's club holds them", () => {
    const trophies = evaluateTrophies(
      run({
        userClubId: "us",
        goldenBootClubId: "us",
        playmakerClubId: "them",
        goldenGloveClubId: "us",
        mvpClubId: "us",
      }),
    );
    expect(trophies).toContain("golden-boot");
    expect(trophies).not.toContain("playmaker");
    expect(trophies).toContain("golden-glove");
    expect(trophies).toContain("mvp");
  });

  it("returns an empty list when nothing was won and no award was held", () => {
    expect(evaluateTrophies(run({ position: 10 }))).toEqual([]);
  });

  it("awards Golden Generation (nations-champion) only for position 1 with a nations-locked run", () => {
    expect(evaluateTrophies(run({ position: 1, nationsLocked: true }))).toContain("nations-champion");
    expect(evaluateTrophies(run({ position: 2, nationsLocked: true }))).not.toContain("nations-champion");
    // Winning the league with a normal (non-nations-locked) squad never earns it, even though the
    // position condition is otherwise identical to "champions".
    expect(evaluateTrophies(run({ position: 1, nationsLocked: false }))).not.toContain("nations-champion");
    expect(evaluateTrophies(run({ position: 1 }))).not.toContain("nations-champion");
  });

  it("can award multiple trophies at once for a dominant title-winning campaign", () => {
    const trophies = evaluateTrophies(
      run({
        userClubId: "us",
        played: 38,
        won: 38,
        drawn: 0,
        lost: 0,
        position: 1,
        goldenBootClubId: "us",
        mvpClubId: "us",
      }),
    );
    expect(trophies).toEqual(expect.arrayContaining(["invincible", "champions", "golden-boot", "mvp"]));
    expect(trophies).toHaveLength(4);
  });
});
