import { describe, expect, it } from "vitest";
import {
  computePoolStats,
  computeScore,
  generateChallenge,
  pickFormation,
  type DailyCandidate,
} from "./daily.logic.js";

/** A rich-enough fixture pool for every theme dimension to clear MIN_POOL_FOR_THEME (8): three
    nationalities and three clubs, each with >= 8 players, plus a few real-ish birthdays. */
function buildPool(): DailyCandidate[] {
  const players: DailyCandidate[] = [];
  const nationalities = ["Brazil", "France", "Norway"];
  const clubs = [
    { id: "club-a", name: "Alpha FC" },
    { id: "club-b", name: "Beta United" },
    { id: "club-c", name: "Gamma City" },
  ];
  let n = 0;
  for (const nationality of nationalities) {
    for (const club of clubs) {
      for (let i = 0; i < 4; i++) {
        n++;
        players.push({
          id: `ps-${String(n).padStart(3, "0")}`,
          playerId: `player-${n}`,
          name: `Player ${n}`,
          nationality,
          birthMonthDay: n === 1 ? "07-22" : "01-01",
          overall: 60 + (n % 30),
          clubId: club.id,
          clubName: club.name,
          positions: ["CM"],
          photoUrl: null,
        });
      }
    }
  }
  return players;
}

describe("generateChallenge", () => {
  it("is deterministic: same date + same pool always yields the same puzzle", () => {
    const pool = buildPool();
    const a = generateChallenge("2026-07-22", pool);
    const b = generateChallenge("2026-07-22", pool);
    expect(a).toEqual(b);
  });

  it("produces different puzzles across different dates (varies theme/anchor)", () => {
    const pool = buildPool();
    const results = new Set(
      ["2026-01-01", "2026-03-15", "2026-07-22", "2026-11-30"].map((date) => JSON.stringify(generateChallenge(date, pool))),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("picks the birthday theme only when a real birthday match exists for that date", () => {
    const pool = buildPool();
    const challenge = generateChallenge("2026-07-22", pool);
    // Player 1 is the only "07-22" birthday in the fixture — if birthday theme was chosen, it must be the anchor.
    if (challenge.theme === "birthday") {
      expect(challenge.anchor.birthMonthDay).toBe("07-22");
    }
  });

  it("derives two constraints (primary + secondary) both traceable to the anchor's own attributes", () => {
    const pool = buildPool();
    const challenge = generateChallenge("2026-07-22", pool);
    expect(challenge.constraints.length).toBe(2);
    const nationalityConstraint = challenge.constraints.find((c) => c.type === "nationality");
    const clubConstraint = challenge.constraints.find((c) => c.type === "club");
    expect(nationalityConstraint?.value).toBe(challenge.anchor.nationality);
    expect(clubConstraint?.value).toBe(challenge.anchor.clubId);
  });

  it("throws on an empty pool", () => {
    expect(() => generateChallenge("2026-07-22", [])).toThrow();
  });

  it("falls back gracefully on a pool too small for any theme dimension", () => {
    const tinyPool: DailyCandidate[] = [
      {
        id: "ps-1",
        playerId: "p-1",
        name: "Solo Player",
        nationality: "Iceland",
        birthMonthDay: "05-05",
        overall: 70,
        clubId: "club-x",
        clubName: "Solo FC",
        positions: ["ST"],
        photoUrl: null,
      },
    ];
    const challenge = generateChallenge("2026-07-22", tinyPool);
    expect(challenge.anchor.playerId).toBe("p-1");
    expect(challenge.constraints.every((c) => c.required === 0)).toBe(true);
  });
});

describe("pickFormation", () => {
  it("is deterministic per date", () => {
    expect(pickFormation("2026-07-22")).toBe(pickFormation("2026-07-22"));
  });
});

describe("computePoolStats", () => {
  it("counts eligible players per constraint, excluding the anchor", () => {
    const pool = buildPool();
    const challenge = generateChallenge("2026-07-22", pool);
    const stats = computePoolStats(pool, challenge.anchor, challenge.constraints);
    expect(stats.totalPlayers).toBe(pool.length - 1);
    stats.eligiblePerConstraint.forEach((count, i) => {
      const constraint = challenge.constraints[i]!;
      const expected = pool.filter(
        (c) =>
          c.playerId !== challenge.anchor.playerId &&
          (constraint.type === "nationality" ? c.nationality === constraint.value : c.clubId === constraint.value),
      ).length;
      expect(count).toBe(expected);
    });
  });
});

describe("computeScore", () => {
  const constraints = [
    { type: "nationality" as const, value: "Brazil", label: "Brazil", required: 2, description: "2 other Brazil players" },
    { type: "club" as const, value: "club-a", label: "Alpha FC", required: 1, description: "1 other player whose featured season was at Alpha FC" },
  ];

  it("awards full marks (== maxScore) for exactly meeting every requirement", () => {
    const picks = [
      { playerId: "p1", nationality: "Brazil", clubId: "club-z" },
      { playerId: "p2", nationality: "Brazil", clubId: "club-z" },
      { playerId: "p3", nationality: "France", clubId: "club-a" },
    ];
    const result = computeScore(picks, constraints);
    expect(result.maxScore).toBe(30);
    expect(result.score).toBe(30);
    expect(result.results.every((r) => r.met)).toBe(true);
  });

  it("awards partial credit below maxScore for an unmet constraint", () => {
    const picks = [{ playerId: "p1", nationality: "Brazil", clubId: "club-z" }];
    const result = computeScore(picks, constraints);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.results.find((r) => r.constraint.type === "nationality")?.met).toBe(false);
  });

  it("scores above maxScore for exceeding a requirement (bonus points)", () => {
    const picks = [
      { playerId: "p1", nationality: "Brazil", clubId: "club-z" },
      { playerId: "p2", nationality: "Brazil", clubId: "club-z" },
      { playerId: "p3", nationality: "Brazil", clubId: "club-z" },
      { playerId: "p4", nationality: "France", clubId: "club-a" },
    ];
    const result = computeScore(picks, constraints);
    expect(result.score).toBeGreaterThan(result.maxScore);
  });

  it("dedupes picks by playerId so the same real person can't be double-counted", () => {
    const picks = [
      { playerId: "p1", nationality: "Brazil", clubId: "club-z" },
      { playerId: "p1", nationality: "Brazil", clubId: "club-z" },
    ];
    const result = computeScore(picks, constraints);
    const nationalityResult = result.results.find((r) => r.constraint.type === "nationality")!;
    expect(nationalityResult.matched).toBe(1);
  });
});
