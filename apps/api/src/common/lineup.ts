import type { Position } from "@futbol/domain";

export interface DraftCandidate {
  refPlayerSeasonId: string;
  positions: Position[];
  overall: number;
}

export interface LineupSlot {
  position: Position;
  refPlayerSeasonId: string;
}

export interface Lineup {
  starters: LineupSlot[];
  bench: LineupSlot[];
}

const FORMATION_POSITIONS: Record<string, Position[]> = {
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
  "4-1-2-1-2": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST", "ST"],
  "4-2-2-2": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LM", "RM", "ST", "ST"],
};

export function positionsForFormation(formation: string): Position[] {
  const positions = FORMATION_POSITIONS[formation];
  if (!positions) throw new Error(`Unknown formation: ${formation}`);
  return positions;
}

/**
 * Greedily fills each formation slot with the highest-overall remaining
 * player eligible for that position (falling back to the best remaining
 * player of any position if none match), then banks the rest as substitutes.
 * Deterministic given a stable input order.
 */
export function buildLineup(formation: string, pool: DraftCandidate[]): Lineup {
  const formationSlots = positionsForFormation(formation);
  const available = [...pool];

  const takeBestFor = (slot: Position): DraftCandidate | undefined => {
    if (available.length === 0) return undefined;
    const matches = available.filter((p) => p.positions.includes(slot));
    const source = matches.length > 0 ? matches : available;
    const best = source.reduce((a, b) => (b.overall > a.overall ? b : a));
    const idx = available.indexOf(best);
    if (idx >= 0) available.splice(idx, 1);
    return best;
  };

  const starters: LineupSlot[] = [];
  for (const slot of formationSlots) {
    const player = takeBestFor(slot);
    if (player) starters.push({ position: slot, refPlayerSeasonId: player.refPlayerSeasonId });
  }

  const bench: LineupSlot[] = available
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 12)
    .map((p) => ({ position: p.positions[0] ?? "CM", refPlayerSeasonId: p.refPlayerSeasonId }));

  return { starters, bench };
}
