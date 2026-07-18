import { describe, expect, it } from "vitest";
import { buildSquad, type WorldClubRow, type WorldPlayerRow } from "./build-squad.js";

function makePlayer(id: string, position: string): WorldPlayerRow {
  return {
    id,
    refPlayerSeasonId: `ref-${id}`,
    name: `Player ${id}`,
    age: 25,
    positions: [position],
    preferredFoot: "right",
    weakFoot: 3,
    attributes: {
      technical: {
        corners: 10, crossing: 10, dribbling: 10, finishing: 10, firstTouch: 10, freeKicks: 10,
        heading: 10, longShots: 10, longThrows: 10, marking: 10, passing: 10, penalties: 10,
        tackling: 10, technique: 10,
      },
      mental: {
        aggression: 10, anticipation: 10, bravery: 10, composure: 10, concentration: 10,
        decisions: 10, determination: 10, flair: 10, leadership: 10, offTheBall: 10,
        positioning: 10, teamwork: 10, vision: 10, workRate: 10,
      },
      physical: {
        acceleration: 10, agility: 10, balance: 10, jumping: 10, naturalFitness: 10,
        pace: 10, stamina: 10, strength: 10,
      },
      goalkeeping: {
        aerialAbility: 10, commandOfArea: 10, communication: 10, eccentricity: 10, handling: 10,
        kicking: 10, oneOnOnes: 10, reflexes: 10, rushingOut: 10, throwing: 10,
      },
    },
    overall: 65,
    potential: 70,
    traits: [],
    fitness: 1,
    morale: 0.5,
    form: 0.5,
    sharpness: 1,
  };
}

describe("buildSquad", () => {
  it("reconstructs a Squad from persisted club + player rows", () => {
    const club: WorldClubRow = {
      id: "club-1",
      worldId: "world-1",
      name: "Test FC",
      formation: "4-4-2",
      lineup: [
        { position: "GK", playerId: "p1" },
        { position: "LB", playerId: "p2" },
      ],
      bench: [{ position: "ST", playerId: "p3" }],
    };
    const players = [makePlayer("p1", "GK"), makePlayer("p2", "LB"), makePlayer("p3", "ST")];

    const squad = buildSquad(club, players);

    expect(squad.clubId).toBe("club-1");
    expect(squad.formation).toBe("4-4-2");
    expect(squad.startingXI).toEqual([
      { position: "GK", playerId: "p1" },
      { position: "LB", playerId: "p2" },
    ]);
    expect(squad.substitutes).toEqual([{ position: "ST", playerId: "p3" }]);
    expect(squad.players).toHaveLength(3);
    expect(squad.players[0]?.attributes.technical.finishing).toBe(10);
  });

  it("defaults to 4-4-2 and empty lineup/bench when the club has none set", () => {
    const club: WorldClubRow = {
      id: "club-2",
      worldId: "world-1",
      name: "Empty FC",
      formation: null,
      lineup: null,
      bench: null,
    };
    const squad = buildSquad(club, []);
    expect(squad.formation).toBe("4-4-2");
    expect(squad.startingXI).toEqual([]);
    expect(squad.substitutes).toEqual([]);
  });
});
