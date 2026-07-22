/** Pure turn-engine helpers factored out of live-draft.gateway.ts (Prisma/WebSocket-coupled) so the
    snake-draft ordering and auto-pick fallback are unit-testable without a live socket connection —
    the same pattern as lineup.ts/round-robin.ts/leagues.logic.ts. */

/** Every live-draft room shares one fixed formation (see LiveDraftRoom's schema comment), so every
    participant always needs exactly this many picks regardless of which formation it is. */
export const LIVE_DRAFT_SLOT_COUNT = 11;

/**
 * Standard snake-draft seat order: round 0 goes seat 0→N-1, round 1 reverses N-1→0, round 2 goes
 * 0→N-1 again, etc. — the fairness convention every fantasy-draft format uses so nobody is stuck
 * picking last every single round. `pickNumber` is the room's global 0-based turn counter.
 */
export function seatForPick(pickNumber: number, participantCount: number): number {
  const round = Math.floor(pickNumber / participantCount);
  const posInRound = pickNumber % participantCount;
  return round % 2 === 0 ? posInRound : participantCount - 1 - posInRound;
}

export function totalPicksForRoom(participantCount: number): number {
  return participantCount * LIVE_DRAFT_SLOT_COUNT;
}

export function isRoomComplete(pickNumber: number, participantCount: number): boolean {
  return pickNumber >= totalPicksForRoom(participantCount);
}

export interface AutoPickCandidate {
  id: string;
  playerId: string;
  overall: number;
}

/**
 * Turn-timeout fallback: the highest-overall not-yet-drafted player in the room's pool, regardless
 * of position — the priority is keeping the room moving, not a positionally-sound squad (an AFK
 * participant already accepted that tradeoff by not acting). `draftedPlayerIds` is every playerId
 * already picked by ANYONE in the room so far (the shared-pool constraint), not just this
 * participant's own picks.
 */
export function pickAutoSelection(pool: AutoPickCandidate[], draftedPlayerIds: Set<string>): AutoPickCandidate | undefined {
  let best: AutoPickCandidate | undefined;
  for (const candidate of pool) {
    if (draftedPlayerIds.has(candidate.playerId)) continue;
    if (!best || candidate.overall > best.overall) best = candidate;
  }
  return best;
}
