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
  /** "prime" swaps in each player's career-best season's rating/attributes, keeping the drawn club-season as display context. */
  ratingsMode: z.enum(["season", "prime"]).optional(),
});
export type PlayerSeasonFilterDto = z.infer<typeof playerSeasonFilterSchema>;
