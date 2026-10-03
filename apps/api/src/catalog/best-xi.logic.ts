/** A league's top-rated XI by our own ratings — the data behind the per-league "Best XI" pages.
    Pure so the picking rules are testable without a database. */

export interface BestXiCandidate {
  playerSeasonId: string;
  playerId: string;
  name: string;
  nationality: string;
  photoUrl: string | null;
  clubName: string;
  seasonYear: number;
  overall: number;
  /** The player's primary position that season. */
  position: string;
}

export interface BestXiSlot {
  /** The slot's label on the team sheet. */
  slot: string;
  pick: BestXiCandidate | null;
  alternatives: BestXiCandidate[];
}

/** 4-3-3 with a holding, a central and an attacking midfielder. Wide slots also take the rare
    RM/LM, the striker slot a CF — the primary positions the dataset uses. */
export const BEST_XI_SLOTS: { slot: string; positions: string[] }[] = [
  { slot: "GK", positions: ["GK"] },
  { slot: "RB", positions: ["RB"] },
  { slot: "CB", positions: ["CB"] },
  { slot: "CB", positions: ["CB"] },
  { slot: "LB", positions: ["LB"] },
  { slot: "CDM", positions: ["CDM"] },
  { slot: "CM", positions: ["CM"] },
  { slot: "CAM", positions: ["CAM"] },
  { slot: "RW", positions: ["RW", "RM"] },
  { slot: "ST", positions: ["ST", "CF"] },
  { slot: "LW", positions: ["LW", "LM"] },
];

/**
 * Fills each slot with the highest-rated player whose primary position fits, each player at most
 * once (at their best season in the league — the first time they appear in rating order). Each
 * slot then lists the next `alternativeCount` best players for it who aren't in the XI.
 */
export function pickBestXi(candidates: BestXiCandidate[], alternativeCount = 3): BestXiSlot[] {
  const ordered = [...candidates].sort((a, b) => b.overall - a.overall || b.seasonYear - a.seasonYear);
  // One entry per player: their best-rated season.
  const best = new Map<string, BestXiCandidate>();
  for (const c of ordered) if (!best.has(c.playerId)) best.set(c.playerId, c);
  const pool = [...best.values()];

  const used = new Set<string>();
  const picks = BEST_XI_SLOTS.map(({ positions }) => {
    const pick = pool.find((c) => positions.includes(c.position) && !used.has(c.playerId)) ?? null;
    if (pick) used.add(pick.playerId);
    return pick;
  });

  return BEST_XI_SLOTS.map(({ slot, positions }, i) => ({
    slot,
    pick: picks[i] ?? null,
    alternatives: pool.filter((c) => positions.includes(c.position) && !used.has(c.playerId)).slice(0, alternativeCount),
  }));
}
