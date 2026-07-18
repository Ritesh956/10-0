import { z } from "zod";
import { formation } from "@futbol/domain";

export const draftClubSchema = z.object({
  refClubSeasonId: z.string(),
  formation: formation.default("4-4-2"),
});
export type DraftClubDto = z.infer<typeof draftClubSchema>;

export const draftFantasySchema = z.object({
  name: z.string().min(2).max(40),
  formation: formation.default("4-4-2"),
  refPlayerSeasonIds: z.array(z.string()).min(11).max(23),
});
export type DraftFantasyDto = z.infer<typeof draftFantasySchema>;
