import type { Formation, PlayerAttributes, Position, Squad, SquadPlayer, Trait } from "@futbol/domain";

type PreferredFoot = SquadPlayer["preferredFoot"];

export interface WorldClubRow {
  id: string;
  worldId: string;
  name: string;
  formation: string | null;
  lineup: unknown;
  bench: unknown;
}

export interface WorldPlayerRow {
  id: string;
  refPlayerSeasonId: string;
  name: string;
  age: number;
  positions: string[];
  preferredFoot: string;
  weakFoot: number;
  attributes: unknown;
  overall: number;
  potential: number;
  traits: string[];
  fitness: number;
  morale: number;
  form: number;
  sharpness: number;
}

interface LineupSlotJson {
  position: string;
  playerId: string;
}

function toSquadPlayer(row: WorldPlayerRow): SquadPlayer {
  return {
    id: row.id,
    refPlayerSeasonId: row.refPlayerSeasonId,
    name: row.name,
    age: row.age,
    positions: row.positions as Position[],
    preferredFoot: row.preferredFoot as PreferredFoot,
    weakFoot: row.weakFoot,
    attributes: row.attributes as PlayerAttributes,
    overall: row.overall,
    potential: row.potential,
    traits: row.traits as Trait[],
    fitness: row.fitness,
    morale: row.morale,
    form: row.form,
    sharpness: row.sharpness,
  };
}

/** Reconstructs a domain Squad from persisted WorldClub + WorldPlayer rows so the engine can simulate a match. */
export function buildSquad(club: WorldClubRow, players: WorldPlayerRow[]): Squad {
  const lineupSlots = (club.lineup as LineupSlotJson[] | null) ?? [];
  const benchSlots = (club.bench as LineupSlotJson[] | null) ?? [];

  return {
    id: club.id,
    worldId: club.worldId,
    clubId: club.id,
    name: club.name,
    formation: (club.formation ?? "4-4-2") as Formation,
    startingXI: lineupSlots.map((s) => ({ position: s.position as Position, playerId: s.playerId })),
    substitutes: benchSlots.map((s) => ({ position: s.position as Position, playerId: s.playerId })),
    players: players.map(toSquadPlayer),
  };
}
