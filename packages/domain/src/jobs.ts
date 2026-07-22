import { z } from "zod";

/** BullMQ queue name shared by the API (producer) and sim-worker (consumer). */
export const SEASON_SIM_QUEUE = "season-simulation";

export const seasonSimJob = z.object({
  worldId: z.string(),
  seasonId: z.string(),
  /** Simulate only fixtures up to (and including) this matchday, then stop — used to pause a
   * domestic season at its halfway point for the January Transfer Window. Omitted = simulate
   * every remaining scheduled fixture. */
  throughMatchday: z.number().int().positive().optional(),
});
export type SeasonSimJob = z.infer<typeof seasonSimJob>;
