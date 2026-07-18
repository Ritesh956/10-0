import { z } from "zod";

/** BullMQ queue name shared by the API (producer) and sim-worker (consumer). */
export const SEASON_SIM_QUEUE = "season-simulation";

export const seasonSimJob = z.object({
  worldId: z.string(),
  seasonId: z.string(),
});
export type SeasonSimJob = z.infer<typeof seasonSimJob>;
