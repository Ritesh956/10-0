/**
 * Maps a catalog `overall` onto the engine's [0,1] `quality`, which seeds generateAttributes().
 * Shared by packages/db/prisma/seed-real.ts (which bakes the attributes into the reference catalog)
 * and tools/sim-lab (which rebuilds the same attributes to calibrate against), so the two can never
 * drift apart.
 *
 * A straight line from 62 (quality 0) to 97 (quality 1, the dataset's cap) — about 0.029 quality per
 * overall point. Tuned together with the OVR curve in tools/data-etl/ovr_spread.py and the engine's
 * GK_SAVE_PIVOT against tools/sim-lab's real-league harness: with this slope a league's best and
 * worst real XIs produce a realistic table (champion ~80-90 pts, safety line ~35, finish strongly
 * tracking squad strength). The bottom of the dataset (58-61, fringe players) clamps to 0.
 */
export const QUALITY_OVR_FLOOR = 62;
export const QUALITY_OVR_CAP = 97;

export function overallToEngineQuality(overall: number): number {
  return Math.min(1, Math.max(0, (overall - QUALITY_OVR_FLOOR) / (QUALITY_OVR_CAP - QUALITY_OVR_FLOOR)));
}
