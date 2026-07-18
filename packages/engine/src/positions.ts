import type { Position } from "@futbol/domain";

/** How much a player's rating at each position feeds each tactical unit. Rows need not sum to 1. */
export interface UnitWeights {
  attack: number;
  creation: number;
  defence: number;
  goalkeeping: number;
}

export const POSITION_UNIT_WEIGHTS: Record<Position, UnitWeights> = {
  GK: { attack: 0, creation: 0, defence: 0, goalkeeping: 1 },
  CB: { attack: 0, creation: 0, defence: 1, goalkeeping: 0 },
  LB: { attack: 0, creation: 0.3, defence: 0.7, goalkeeping: 0 },
  RB: { attack: 0, creation: 0.3, defence: 0.7, goalkeeping: 0 },
  LWB: { attack: 0.1, creation: 0.4, defence: 0.5, goalkeeping: 0 },
  RWB: { attack: 0.1, creation: 0.4, defence: 0.5, goalkeeping: 0 },
  CDM: { attack: 0, creation: 0.4, defence: 0.6, goalkeeping: 0 },
  CM: { attack: 0.1, creation: 0.7, defence: 0.2, goalkeeping: 0 },
  CAM: { attack: 0.3, creation: 0.7, defence: 0, goalkeeping: 0 },
  LM: { attack: 0.3, creation: 0.5, defence: 0.2, goalkeeping: 0 },
  RM: { attack: 0.3, creation: 0.5, defence: 0.2, goalkeeping: 0 },
  LW: { attack: 0.6, creation: 0.4, defence: 0, goalkeeping: 0 },
  RW: { attack: 0.6, creation: 0.4, defence: 0, goalkeeping: 0 },
  ST: { attack: 0.9, creation: 0.1, defence: 0, goalkeeping: 0 },
  CF: { attack: 0.7, creation: 0.3, defence: 0, goalkeeping: 0 },
};

/** Positions considered "attacking" for scorer/shot-taker weighting. */
export const ATTACKING_POSITIONS: ReadonlySet<Position> = new Set([
  "LW",
  "RW",
  "ST",
  "CF",
  "CAM",
]);

/** Positions considered "creative" for assist/pass weighting. */
export const CREATIVE_POSITIONS: ReadonlySet<Position> = new Set([
  "CM",
  "CAM",
  "LM",
  "RM",
  "LWB",
  "RWB",
]);

/** Positions considered "defensive" for tackle weighting. */
export const DEFENSIVE_POSITIONS: ReadonlySet<Position> = new Set([
  "CB",
  "LB",
  "RB",
  "CDM",
  "LWB",
  "RWB",
]);
