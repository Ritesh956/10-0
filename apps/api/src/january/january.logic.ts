/** Pure decision logic for resolving a January Transfer Window gamble — factored out of
    january.service.ts (which is Prisma-coupled) so the weighting, weakest-slot detection, and
    candidate-biasing rules are unit-testable without mocking the database, matching the pattern
    already used by lineup.ts/round-robin.ts/build-squad.ts. */

export type JanuaryEventType = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

/** Weighted so a gamble is more often a wash or an upgrade than a genuine downgrade, while still
    keeping the "can help or hurt" flavor 38-0's setup copy promises. */
export const EVENT_WEIGHTS: { type: JanuaryEventType; weight: number }[] = [
  { type: "POSITIVE", weight: 35 },
  { type: "NEUTRAL", weight: 40 },
  { type: "NEGATIVE", weight: 25 },
];

export function totalEventWeight(): number {
  return EVENT_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
}

/** Maps a roll in [0, totalEventWeight()) to an event type — pure so the weighting can be
    unit-tested without going through crypto.randomInt. */
export function pickEventType(roll: number): JanuaryEventType {
  let remaining = roll;
  for (const w of EVENT_WEIGHTS) {
    if (remaining < w.weight) return w.type;
    remaining -= w.weight;
  }
  return "NEUTRAL";
}

export interface LineupSlotJson {
  position: string;
  playerId: string;
}

export interface OverallLookup {
  overall: number;
}

/** The weakest-rated occupied lineup slot — the one January strengthens. Ties resolve to
    whichever slot appears first in `lineup`. */
export function findWeakestSlot<T extends OverallLookup>(
  lineup: LineupSlotJson[],
  playerById: Map<string, T>,
): { slot: LineupSlotJson; player: T } | undefined {
  let weakestSlot: LineupSlotJson | undefined;
  let weakestPlayer: T | undefined;
  for (const slot of lineup) {
    const player = playerById.get(slot.playerId);
    if (!player) continue;
    if (!weakestPlayer || player.overall < weakestPlayer.overall) {
      weakestSlot = slot;
      weakestPlayer = player;
    }
  }
  return weakestSlot && weakestPlayer ? { slot: weakestSlot, player: weakestPlayer } : undefined;
}

/** Narrows a candidate pool to upgrades (POSITIVE) or downgrades (NEGATIVE) relative to the
    outgoing player's overall, falling back to the full pool when the biased slice is empty (e.g.
    nobody stronger exists at that position/era) so a draw is always possible. NEUTRAL never
    narrows. */
export function biasPoolForEvent<T extends OverallLookup>(
  pool: T[],
  eventType: JanuaryEventType,
  outgoingOverall: number,
): T[] {
  const biased =
    eventType === "POSITIVE"
      ? pool.filter((p) => p.overall > outgoingOverall)
      : eventType === "NEGATIVE"
        ? pool.filter((p) => p.overall < outgoingOverall)
        : pool;
  return biased.length > 0 ? biased : pool;
}
