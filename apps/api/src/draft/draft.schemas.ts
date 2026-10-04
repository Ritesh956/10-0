import { z } from "zod";
import { formation, position } from "@futbol/domain";

export const draftClubSchema = z.object({
  refClubSeasonId: z.string(),
  formation: formation.default("4-4-2"),
  refManagerId: z.string().optional(),
});
export type DraftClubDto = z.infer<typeof draftClubSchema>;

export const draftFantasySchema = z.object({
  name: z.string().min(2).max(40),
  formation: formation.default("4-4-2"),
  refPlayerSeasonIds: z.array(z.string()).min(11).max(23),
  /** The user's own slot assignments from the draft room — stored exactly as given. Omitted only
      where nobody chose slots (live draft), in which case the server auto-fills via buildLineup. */
  lineup: z.array(z.object({ position, refPlayerSeasonId: z.string() })).length(11).optional(),
  refManagerId: z.string().optional(),
});
export type DraftFantasyDto = z.infer<typeof draftFantasySchema>;
