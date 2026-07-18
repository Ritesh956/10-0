import { z } from "zod";

const commaList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean) : undefined));

export const clubSeasonFilterSchema = z.object({
  eraId: z.string().optional(),
  leagueIds: commaList,
});
export type ClubSeasonFilterDto = z.infer<typeof clubSeasonFilterSchema>;

export const playerSeasonFilterSchema = z.object({
  eraId: z.string().optional(),
  leagueIds: commaList,
  clubSeasonId: z.string().optional(),
  positions: commaList,
});
export type PlayerSeasonFilterDto = z.infer<typeof playerSeasonFilterSchema>;
