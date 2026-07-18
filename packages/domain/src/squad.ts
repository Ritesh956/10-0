import { z } from "zod";
import { squadPlayer } from "./player.js";
import { formation, squadSlot } from "./tactics.js";

export const squad = z.object({
  id: z.string(),
  worldId: z.string(),
  clubId: z.string(),
  name: z.string(),
  formation,
  startingXI: z.array(squadSlot).length(11),
  substitutes: z.array(squadSlot).max(12),
  players: z.array(squadPlayer),
});
export type Squad = z.infer<typeof squad>;
