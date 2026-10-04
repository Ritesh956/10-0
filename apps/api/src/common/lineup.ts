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
 * Which slots a player listed at a given position can also fill. MUST stay identical to
 * apps/web/src/lib/formations.ts POSITION_COMPATIBILITY — the draft room uses that copy to decide
 * which slots a player may be placed in, and validateUserLineup() below re-checks the submitted
 * lineup against this one, so any drift makes the server reject a lineup the UI allowed.
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

type PositionGroup = "GK" | "DEF" | "MID" | "ATT";

const POSITION_GROUP: Record<Position, PositionGroup> = {
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

/** Whether a player who can play any of `playerPositions` is eligible for `slot`. */
export function canPlayPosition(playerPositions: readonly Position[], slot: Position): boolean {
  return playerPositions.some((p) => POSITION_COMPATIBILITY[p]?.includes(slot));
}

function benchFrom(available: DraftCandidate[]): LineupSlot[] {
  return [...available]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 12)
    .map((p) => ({ position: p.positions[0] ?? "CM", refPlayerSeasonId: p.refPlayerSeasonId }));
}

/**
 * Auto-fills a formation from a pool (AI clubs, draftClub, live-draft picks — anywhere nobody chose
 * the slots). Fills in passes of decreasing fit so a later slot's natural occupant is never stolen
 * by an earlier slot's fallback: exact position → compatible position → same position group → best
 * remaining of any position. Within a pass, slots go in formation order and each takes the
 * highest-overall candidate. Deterministic given a stable input order.
 */
export function buildLineup(formation: string, pool: DraftCandidate[]): Lineup {
  const formationSlots = positionsForFormation(formation);
  const available = [...pool];
  const filled: (DraftCandidate | undefined)[] = formationSlots.map(() => undefined);

  const passes: ((p: DraftCandidate, slot: Position) => boolean)[] = [
    (p, slot) => p.positions.includes(slot),
    (p, slot) => canPlayPosition(p.positions, slot),
    (p, slot) => p.positions.some((pos) => POSITION_GROUP[pos] === POSITION_GROUP[slot]),
    () => true,
  ];

  for (const fits of passes) {
    formationSlots.forEach((slot, i) => {
      if (filled[i] || available.length === 0) return;
      const matches = available.filter((p) => fits(p, slot));
      if (matches.length === 0) return;
      const best = matches.reduce((a, b) => (b.overall > a.overall ? b : a));
      available.splice(available.indexOf(best), 1);
      filled[i] = best;
    });
  }

  const starters: LineupSlot[] = [];
  formationSlots.forEach((slot, i) => {
    const player = filled[i];
    if (player) starters.push({ position: slot, refPlayerSeasonId: player.refPlayerSeasonId });
  });

  return { starters, bench: benchFrom(available) };
}

/**
 * Turns a lineup the user arranged themselves (draft room slot choices, including "Move a player")
 * into a Lineup exactly as given — never re-assigned. Entries may arrive in any order; they're
 * matched to formation slots by position. Throws (with a user-facing message) if the lineup doesn't
 * cover the formation exactly, references players outside the pool, repeats a player, or places a
 * player in a slot they can't play. Pool players not in the lineup go to the bench.
 */
export function validateUserLineup(formation: string, lineup: LineupSlot[], pool: DraftCandidate[]): Lineup {
  const formationSlots = positionsForFormation(formation);
  if (lineup.length !== formationSlots.length) {
    throw new Error(`A ${formation} lineup needs exactly ${formationSlots.length} players (got ${lineup.length}).`);
  }

  const byId = new Map(pool.map((p) => [p.refPlayerSeasonId, p]));
  const seen = new Set<string>();
  for (const entry of lineup) {
    if (!byId.has(entry.refPlayerSeasonId)) throw new Error("A lineup player isn't part of this squad.");
    if (seen.has(entry.refPlayerSeasonId)) throw new Error("The same player appears twice in the lineup.");
    seen.add(entry.refPlayerSeasonId);
  }

  const unused = [...lineup];
  const starters: LineupSlot[] = formationSlots.map((slot) => {
    const idx = unused.findIndex((e) => e.position === slot);
    if (idx < 0) throw new Error(`The lineup is missing a ${slot} for a ${formation}.`);
    const [entry] = unused.splice(idx, 1);
    const player = byId.get(entry!.refPlayerSeasonId)!;
    if (!canPlayPosition(player.positions, slot)) {
      throw new Error(`A player listed at ${player.positions.join("/")} can't play ${slot}.`);
    }
    return { position: slot, refPlayerSeasonId: player.refPlayerSeasonId };
  });

  const bench = benchFrom(pool.filter((p) => !seen.has(p.refPlayerSeasonId)));
  return { starters, bench };
}
