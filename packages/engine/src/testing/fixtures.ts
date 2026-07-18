import type {
  Formation,
  MatchSetup,
  PlayerAttributes,
  Position,
  Squad,
  SquadPlayer,
  SquadSlot,
  Tactics,
} from "@futbol/domain";
import type { Rng } from "../rng.js";

const FORMATION_POSITIONS: Record<Formation, Position[]> = {
  "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "CAM", "LW", "RW", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CM", "CM", "RWB", "ST", "ST"],
  "4-5-1": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "CAM", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "LW", "ST", "RW"],
  "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CM", "CM", "ST", "ST"],
  "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "CM", "RM", "ST"],
  "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "CAM", "ST"],
  "3-4-2-1": ["GK", "CB", "CB", "CB", "LM", "CM", "CM", "RM", "CAM", "CAM", "ST"],
};

const BENCH_POSITIONS: Position[] = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST", "RM"];

function clampQuality(q: number): number {
  return Math.min(1, Math.max(0, q));
}

function randAttr(rng: Rng, center: number, spread: number): number {
  const value = Math.round(center + (rng() - 0.5) * 2 * spread);
  return Math.min(20, Math.max(1, value));
}

/** quality in [0,1] maps to an attribute center of roughly 6-18 on the 1-20 scale. */
export function generateAttributes(rng: Rng, quality: number): PlayerAttributes {
  const center = 6 + clampQuality(quality) * 12;
  const mk = () => randAttr(rng, center, 3);
  return {
    technical: {
      corners: mk(),
      crossing: mk(),
      dribbling: mk(),
      finishing: mk(),
      firstTouch: mk(),
      freeKicks: mk(),
      heading: mk(),
      longShots: mk(),
      longThrows: mk(),
      marking: mk(),
      passing: mk(),
      penalties: mk(),
      tackling: mk(),
      technique: mk(),
    },
    mental: {
      aggression: mk(),
      anticipation: mk(),
      bravery: mk(),
      composure: mk(),
      concentration: mk(),
      decisions: mk(),
      determination: mk(),
      flair: mk(),
      leadership: mk(),
      offTheBall: mk(),
      positioning: mk(),
      teamwork: mk(),
      vision: mk(),
      workRate: mk(),
    },
    physical: {
      acceleration: mk(),
      agility: mk(),
      balance: mk(),
      jumping: mk(),
      naturalFitness: mk(),
      pace: mk(),
      stamina: mk(),
      strength: mk(),
    },
    goalkeeping: {
      aerialAbility: mk(),
      commandOfArea: mk(),
      communication: mk(),
      eccentricity: mk(),
      handling: mk(),
      kicking: mk(),
      oneOnOnes: mk(),
      reflexes: mk(),
      rushingOut: mk(),
      throwing: mk(),
    },
  };
}

let idCounter = 0;

export function generateSquadPlayer(rng: Rng, position: Position, quality: number): SquadPlayer {
  idCounter += 1;
  const q = clampQuality(quality);
  return {
    id: `player-${idCounter}`,
    refPlayerSeasonId: `ref-${idCounter}`,
    name: `Test Player ${idCounter}`,
    age: 18 + Math.floor(rng() * 17),
    positions: [position],
    preferredFoot: rng() < 0.75 ? "right" : "left",
    weakFoot: 1 + Math.floor(rng() * 5),
    attributes: generateAttributes(rng, q),
    overall: Math.min(99, Math.max(1, Math.round(q * 99))),
    potential: Math.min(99, Math.max(1, Math.round(q * 99) + Math.floor(rng() * 10))),
    traits: [],
    fitness: 1,
    morale: 0.5,
    form: 0.5,
    sharpness: 1,
  };
}

export function generateSquad(
  rng: Rng,
  opts: { worldId: string; clubId: string; formation: Formation; quality: number },
): Squad {
  const startingXI: SquadSlot[] = [];
  const players: SquadPlayer[] = [];

  for (const position of FORMATION_POSITIONS[opts.formation]) {
    const player = generateSquadPlayer(rng, position, opts.quality + (rng() - 0.5) * 0.1);
    players.push(player);
    startingXI.push({ position, playerId: player.id });
  }

  const substitutes: SquadSlot[] = [];
  for (const position of BENCH_POSITIONS) {
    const player = generateSquadPlayer(rng, position, opts.quality - 0.05 + (rng() - 0.5) * 0.1);
    players.push(player);
    substitutes.push({ position, playerId: player.id });
  }

  return {
    id: `squad-${opts.clubId}`,
    worldId: opts.worldId,
    clubId: opts.clubId,
    name: `${opts.clubId} Squad`,
    formation: opts.formation,
    startingXI: startingXI as Squad["startingXI"],
    substitutes,
    players,
  };
}

const DEFAULT_TACTICS: Tactics = {
  mentality: "balanced",
  tempo: "balanced",
  width: "balanced",
  pressing: "medium",
  passingStyle: "mixed",
};

export function generateMatchSetup(
  rng: Rng,
  opts: {
    matchId: string;
    worldId: string;
    homeClubId: string;
    awayClubId: string;
    homeQuality: number;
    awayQuality: number;
    homeFormation?: Formation;
    awayFormation?: Formation;
    homeTactics?: Partial<Tactics>;
    awayTactics?: Partial<Tactics>;
  },
): MatchSetup {
  const homeSquad = generateSquad(rng, {
    worldId: opts.worldId,
    clubId: opts.homeClubId,
    formation: opts.homeFormation ?? "4-4-2",
    quality: opts.homeQuality,
  });
  const awaySquad = generateSquad(rng, {
    worldId: opts.worldId,
    clubId: opts.awayClubId,
    formation: opts.awayFormation ?? "4-4-2",
    quality: opts.awayQuality,
  });

  return {
    matchId: opts.matchId,
    worldId: opts.worldId,
    home: {
      clubId: opts.homeClubId,
      squad: homeSquad,
      tactics: { ...DEFAULT_TACTICS, ...opts.homeTactics },
      isHome: true,
    },
    away: {
      clubId: opts.awayClubId,
      squad: awaySquad,
      tactics: { ...DEFAULT_TACTICS, ...opts.awayTactics },
      isHome: false,
    },
    weather: "clear",
    importance: "league",
    neutralVenue: false,
    rivalryIntensity: 0,
  };
}
