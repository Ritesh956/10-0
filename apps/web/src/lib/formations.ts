/**
 * Mirrors apps/api/src/common/lineup.ts FORMATION_POSITIONS — same formations,
 * same slot order, since a drafted XI is submitted with this exact formation
 * string and the backend's buildLineup fills starters in this slot order.
 * apps/web hand-mirrors domain shapes instead of importing @futbol/domain
 * (separate bundler build target), so Position/Formation live here too.
 */
export type Position =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "LWB"
  | "RWB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "ST"
  | "CF";

export type PositionGroup = "GK" | "DEF" | "MID" | "ATT";

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LM: "MID",
  RM: "MID",
  LW: "ATT",
  RW: "ATT",
  ST: "ATT",
  CF: "ATT",
};

const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeeper",
  CB: "Centre",
  LB: "Left",
  RB: "Right",
  LWB: "Left",
  RWB: "Right",
  CDM: "Defensive",
  CM: "Central",
  CAM: "Attacking",
  LM: "Left",
  RM: "Right",
  LW: "Left",
  RW: "Right",
  ST: "Striker",
  CF: "Forward",
};

export function positionLabel(position: Position): string {
  return POSITION_LABEL[position];
}

/**
 * Which slots a player listed at a given position can also reasonably fill,
 * based on real positional versatility (a CAM can play as a false-9/ST, a CM
 * can drop into a CDM double-pivot or push into a CAM role, etc). Always
 * includes the position itself. Used to decide whether a drafted player is
 * eligible for a pitch slot beyond an exact position match.
 */
export const POSITION_COMPATIBILITY: Record<Position, Position[]> = {
  GK: ["GK"],
  CB: ["CB", "LB", "RB"],
  LB: ["LB", "LWB", "CB"],
  RB: ["RB", "RWB", "CB"],
  LWB: ["LWB", "LB", "LM"],
  RWB: ["RWB", "RB", "RM"],
  CDM: ["CDM", "CM"],
  CM: ["CM", "CDM", "CAM"],
  CAM: ["CAM", "CM", "ST", "CF"],
  LM: ["LM", "LWB", "LW"],
  RM: ["RM", "RWB", "RW"],
  LW: ["LW", "LM", "ST"],
  RW: ["RW", "RM", "ST"],
  ST: ["ST", "CF", "CAM"],
  CF: ["CF", "ST", "CAM"],
};

/** Whether a player who can play any of `playerPositions` is eligible for `slot`. */
export function canPlayPosition(playerPositions: string[], slot: Position): boolean {
  return playerPositions.some((p) => POSITION_COMPATIBILITY[p as Position]?.includes(slot));
}

export interface FormationSlot {
  position: Position;
  /** 0-100, left to right */
  x: number;
  /** 0-100, 0 = attacking third (top), 100 = own goal (bottom) */
  y: number;
}

export const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "4-5-1",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
  "4-4-1-1",
  "3-4-2-1",
] as const;

export type Formation = (typeof FORMATIONS)[number];

export const FORMATION_POSITIONS: Record<Formation, Position[]> = {
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

export const FORMATION_DESCRIPTIONS: Record<Formation, string> = {
  "4-4-2": "Balanced and direct. Two banks of four with a strike partnership up top.",
  "4-3-3": "Attacking with width. Three forwards create constant threat.",
  "4-2-3-1": "Modern control. A double pivot protects the back four, one playmaker floats behind the striker.",
  "3-5-2": "Midfield-heavy. Wing-backs provide the width a back three gives up.",
  "4-5-1": "Solid and compact. A lone striker is backed by a five-man midfield.",
  "3-4-3": "High-risk, high-reward. Committed to attack with a back three.",
  "5-3-2": "Defensively secure. Five at the back with two up top on the counter.",
  "4-1-4-1": "Disciplined shape. A holding midfielder shields the back four.",
  "4-4-1-1": "Two strikers, staggered. One drops deep to link play.",
  "3-4-2-1": "Narrow and creative. Two number tens support a lone striker.",
};

/** Hand-tuned pitch coordinates per formation, same length/order as FORMATION_POSITIONS[formation]. */
const FORMATION_COORDS: Record<Formation, Array<{ x: number; y: number }>> = {
  "4-4-2": [
    { x: 50, y: 93 },
    { x: 15, y: 74 },
    { x: 38, y: 76 },
    { x: 62, y: 76 },
    { x: 85, y: 74 },
    { x: 15, y: 48 },
    { x: 40, y: 50 },
    { x: 60, y: 50 },
    { x: 85, y: 48 },
    { x: 40, y: 20 },
    { x: 60, y: 20 },
  ],
  "4-3-3": [
    { x: 50, y: 93 },
    { x: 15, y: 74 },
    { x: 38, y: 76 },
    { x: 62, y: 76 },
    { x: 85, y: 74 },
    { x: 50, y: 58 },
    { x: 32, y: 46 },
    { x: 68, y: 46 },
    { x: 15, y: 22 },
    { x: 50, y: 16 },
    { x: 85, y: 22 },
  ],
  "4-2-3-1": [
    { x: 50, y: 93 },
    { x: 15, y: 74 },
    { x: 38, y: 76 },
    { x: 62, y: 76 },
    { x: 85, y: 74 },
    { x: 38, y: 58 },
    { x: 62, y: 58 },
    { x: 50, y: 38 },
    { x: 15, y: 22 },
    { x: 85, y: 22 },
    { x: 50, y: 14 },
  ],
  "3-5-2": [
    { x: 50, y: 93 },
    { x: 30, y: 76 },
    { x: 50, y: 78 },
    { x: 70, y: 76 },
    { x: 10, y: 55 },
    { x: 35, y: 50 },
    { x: 50, y: 62 },
    { x: 65, y: 50 },
    { x: 90, y: 55 },
    { x: 40, y: 20 },
    { x: 60, y: 20 },
  ],
  "4-5-1": [
    { x: 50, y: 93 },
    { x: 15, y: 74 },
    { x: 38, y: 76 },
    { x: 62, y: 76 },
    { x: 85, y: 74 },
    { x: 15, y: 50 },
    { x: 40, y: 52 },
    { x: 60, y: 52 },
    { x: 85, y: 50 },
    { x: 50, y: 34 },
    { x: 50, y: 16 },
  ],
  "3-4-3": [
    { x: 50, y: 93 },
    { x: 30, y: 76 },
    { x: 50, y: 78 },
    { x: 70, y: 76 },
    { x: 12, y: 52 },
    { x: 40, y: 50 },
    { x: 60, y: 50 },
    { x: 88, y: 52 },
    { x: 18, y: 22 },
    { x: 50, y: 16 },
    { x: 82, y: 22 },
  ],
  "5-3-2": [
    { x: 50, y: 93 },
    { x: 8, y: 68 },
    { x: 30, y: 78 },
    { x: 50, y: 80 },
    { x: 70, y: 78 },
    { x: 92, y: 68 },
    { x: 35, y: 48 },
    { x: 50, y: 60 },
    { x: 65, y: 48 },
    { x: 40, y: 20 },
    { x: 60, y: 20 },
  ],
  "4-1-4-1": [
    { x: 50, y: 93 },
    { x: 15, y: 74 },
    { x: 38, y: 76 },
    { x: 62, y: 76 },
    { x: 85, y: 74 },
    { x: 50, y: 60 },
    { x: 15, y: 42 },
    { x: 40, y: 44 },
    { x: 60, y: 44 },
    { x: 85, y: 42 },
    { x: 50, y: 16 },
  ],
  "4-4-1-1": [
    { x: 50, y: 93 },
    { x: 15, y: 74 },
    { x: 38, y: 76 },
    { x: 62, y: 76 },
    { x: 85, y: 74 },
    { x: 15, y: 50 },
    { x: 40, y: 52 },
    { x: 60, y: 52 },
    { x: 85, y: 50 },
    { x: 50, y: 32 },
    { x: 50, y: 14 },
  ],
  "3-4-2-1": [
    { x: 50, y: 93 },
    { x: 30, y: 76 },
    { x: 50, y: 78 },
    { x: 70, y: 76 },
    { x: 12, y: 52 },
    { x: 40, y: 50 },
    { x: 60, y: 50 },
    { x: 88, y: 52 },
    { x: 38, y: 30 },
    { x: 62, y: 30 },
    { x: 50, y: 14 },
  ],
};

export function slotsForFormation(formation: Formation): FormationSlot[] {
  const positions = FORMATION_POSITIONS[formation];
  const coords = FORMATION_COORDS[formation];
  return positions.map((position, i) => ({ position, x: coords[i]!.x, y: coords[i]!.y }));
}

export function isFormation(value: string): value is Formation {
  return (FORMATIONS as readonly string[]).includes(value);
}
