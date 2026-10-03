import { describe, expect, it } from "vitest";
import {
  bracketOrder,
  generateLeaguePhase,
  leaguePhaseZone,
  nextRoundPairings,
  pairClubs,
  playoffPairings,
  r16Pairings,
  seedEntrants,
  type Entrant,
  type RankedClub,
} from "./european-format.js";

const COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

/** 36 clubs the way the service builds them: 8 from the user's league, 7 from each of the others. */
function field(): Entrant[] {
  const entrants: Entrant[] = [];
  COUNTRIES.forEach((country, c) => {
    const count = c === 0 ? 8 : 7;
    for (let i = 0; i < count; i++) {
      entrants.push({ clubId: `${country}-${i}`, country, strength: 90 - i * 1.3 - c * 0.35 });
    }
  });
  return entrants;
}

describe("seedEntrants", () => {
  it("orders strongest first and cuts four equal pots", () => {
    const seeded = seedEntrants(field());
    expect(seeded).toHaveLength(36);
    expect(seeded[0]!.seed).toBe(1);
    expect(seeded[0]!.strength).toBeGreaterThanOrEqual(seeded[35]!.strength);
    for (const pot of [1, 2, 3, 4]) expect(seeded.filter((s) => s.pot === pot)).toHaveLength(9);
    expect(seeded.slice(0, 9).every((s) => s.pot === 1)).toBe(true);
  });

  it("is reproducible: equal strengths fall back to the club id", () => {
    const tied = field().map((e) => ({ ...e, strength: 80 }));
    expect(seedEntrants(tied).map((s) => s.clubId)).toEqual(seedEntrants([...tied].reverse()).map((s) => s.clubId));
  });

  it("rejects a field that can't fill four pots", () => {
    expect(() => seedEntrants(field().slice(0, 35))).toThrow();
  });
});

describe("generateLeaguePhase", () => {
  const seeded = seedEntrants(field());
  const fixtures = generateLeaguePhase(seeded, 12345);
  const byId = new Map(seeded.map((s) => [s.clubId, s]));

  it("gives every club exactly eight games, four at home and four away", () => {
    expect(fixtures).toHaveLength(36 * 4);
    for (const club of seeded) {
      const home = fixtures.filter((f) => f.homeClubId === club.clubId).length;
      const away = fixtures.filter((f) => f.awayClubId === club.clubId).length;
      expect([home, away]).toEqual([4, 4]);
    }
  });

  it("never repeats a pairing", () => {
    const keys = fixtures.map((f) => [f.homeClubId, f.awayClubId].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("draws two opponents from every pot, itself included", () => {
    for (const club of seeded) {
      const opponents = fixtures
        .filter((f) => f.homeClubId === club.clubId || f.awayClubId === club.clubId)
        .map((f) => byId.get(f.homeClubId === club.clubId ? f.awayClubId : f.homeClubId)!);
      for (const pot of [1, 2, 3, 4]) expect(opponents.filter((o) => o.pot === pot)).toHaveLength(2);
    }
  });

  it("keeps clubs away from their own league's clubs", () => {
    const same = fixtures.filter((f) => byId.get(f.homeClubId)!.country === byId.get(f.awayClubId)!.country);
    expect(same).toHaveLength(0);
  });

  it("never plays a club twice on one matchday, and keeps the calendar short", () => {
    const seen = new Set<string>();
    for (const f of fixtures) {
      for (const id of [f.homeClubId, f.awayClubId]) {
        const key = `${id}@${f.matchday}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(Math.max(...fixtures.map((f) => f.matchday))).toBeLessThanOrEqual(11);
    expect(Math.min(...fixtures.map((f) => f.matchday))).toBe(1);
  });

  it("is deterministic for a seed", () => {
    expect(generateLeaguePhase(seeded, 12345)).toEqual(fixtures);
  });

  it("avoids same-league games across many different draws", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const draw = generateLeaguePhase(seeded, seed * 7919);
      expect(draw.filter((f) => byId.get(f.homeClubId)!.country === byId.get(f.awayClubId)!.country)).toHaveLength(0);
    }
  });
});

describe("leaguePhaseZone", () => {
  it("splits a 36-club table 8 / 16 / 12", () => {
    expect(leaguePhaseZone(1)).toBe("R16");
    expect(leaguePhaseZone(8)).toBe("R16");
    expect(leaguePhaseZone(9)).toBe("PO");
    expect(leaguePhaseZone(24)).toBe("PO");
    expect(leaguePhaseZone(25)).toBe("OUT");
    expect(leaguePhaseZone(36)).toBe("OUT");
  });
});

describe("knockout bracket", () => {
  const table: RankedClub[] = Array.from({ length: 36 }, (_, i) => ({ clubId: `c${i + 1}`, rank: i + 1 }));
  const rankOf = (clubId: string) => Number(clubId.slice(1));

  it("pairs the play-offs 9v24 … 16v17 with the better seed first", () => {
    const pairs = playoffPairings(table);
    expect(pairs).toHaveLength(8);
    expect(pairs.map(([a, b]) => [a.rank, b.rank])).toEqual([
      [9, 24],
      [10, 23],
      [11, 22],
      [12, 21],
      [13, 20],
      [14, 19],
      [15, 18],
      [16, 17],
    ]);
  });

  it("gives the top seeds the weakest play-off path in the Round of 16", () => {
    const winners = playoffPairings(table).map(([stronger]) => ({ strongerRank: stronger.rank, winner: stronger }));
    const r16 = r16Pairings(table, winners);
    expect(r16).toHaveLength(8);
    expect(r16.map(([a, b]) => [a.rank, b.rank])).toEqual([
      [1, 16],
      [2, 15],
      [3, 14],
      [4, 13],
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ]);
  });

  it("recovers every tie's bracket slot from who played whom, and plays the chalk bracket out", () => {
    // Round of 16 as the seeds fall (1v16 … 8v9), then favourites win every round.
    let pairings = r16Pairings(
      table,
      playoffPairings(table).map(([stronger]) => ({ strongerRank: stronger.rank, winner: stronger })),
    );
    const rounds: Record<string, { id: string; homeClubId: string; awayClubId: string }[]> = {};
    let stage: "R16" | "QF" | "SF" | "FINAL" = "R16";
    const next = { R16: "QF", QF: "SF", SF: "FINAL" } as const;
    const champions: string[] = [];

    for (;;) {
      const ties = pairings.map(([a, b], i) => ({ id: `${stage}-${i}`, homeClubId: a.clubId, awayClubId: b.clubId }));
      // Shuffle the stored order: the bracket must come back from the clubs, not insertion order.
      rounds[stage] = [...ties].reverse();
      const order = bracketOrder(rounds, rankOf);
      const ordered = [...ties].sort((x, y) => order.get(x.id)! - order.get(y.id)!);
      expect(ordered.map((t) => t.id)).toEqual(ties.map((t) => t.id));

      const winners = ordered.map((t) => ({ clubId: t.homeClubId, rank: rankOf(t.homeClubId) }));
      if (stage === "FINAL") {
        champions.push(winners[0]!.clubId);
        break;
      }
      pairings = nextRoundPairings(winners);
      stage = next[stage];
    }
    expect(champions).toEqual(["c1"]);
  });

  it("keeps the top seeds apart until late: 1 and 2 can only meet in the final", () => {
    const winners = [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => ({ clubId: `c${rank}`, rank }));
    const qf = nextRoundPairings(winners).map(([a, b]) => [a.rank, b.rank]);
    expect(qf).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
    const sf = nextRoundPairings([1, 2, 3, 4].map((rank) => ({ clubId: `c${rank}`, rank }))).map(([a, b]) => [a.rank, b.rank]);
    expect(sf).toEqual([
      [1, 4],
      [2, 3],
    ]);
  });

  it("pairClubs puts the better seed first", () => {
    expect(pairClubs({ clubId: "x", rank: 9 }, { clubId: "y", rank: 3 })[0].clubId).toBe("y");
  });
});
