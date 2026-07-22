import { canPlayPosition, FORMATION_POSITIONS, type Formation, type Position } from "./formations";

export interface FormationFillability {
  fillable: boolean;
  /** Distinct slot positions with nobody eligible, in formation order. */
  missingPositions: Position[];
}

/**
 * One-Club XI (Phase 7): a cheap feasibility check for "can this formation actually be filled from
 * this club's real history" — for every slot the formation needs, is there at least one position
 * among the club's own historically-recorded positions (apps/api's getClubPositionCoverage) that's
 * eligible for it via the same versatility graph the draft itself enforces (canPlayPosition)?
 *
 * This is a coverage heuristic, not a full one-player-per-slot matching — it can't catch the
 * pathological case where the same single player is the only one who could fill two different
 * slots. A real top-flight club's multi-season history is deep enough that this doesn't matter in
 * practice; the draft's own auto-reroll (DraftPage's doSpin) is still the real backstop against a
 * genuinely dead pick.
 */
export function checkFormationFillable(formation: Formation, clubPositions: string[]): FormationFillability {
  const missing = new Set<Position>();
  for (const slot of FORMATION_POSITIONS[formation]) {
    if (!canPlayPosition(clubPositions, slot)) missing.add(slot);
  }
  return { fillable: missing.size === 0, missingPositions: [...missing] };
}
