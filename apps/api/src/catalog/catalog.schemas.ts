import { z } from "zod";

const commaList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean) : undefined));

export const clubSeasonFilterSchema = z.object({
  eraId: z.string().optional(),
  leagueIds: commaList,
  /** One-Club mode (Phase 7): scopes the pool to a single real club's entire history instead of a
      league — independent of leagueIds/eraId so a club that changed leagues over time still returns
      its full record. DraftPage passes this instead of leagueIds when config.lockedClubId is set. */
  clubId: z.string().optional(),
});
export type ClubSeasonFilterDto = z.infer<typeof clubSeasonFilterSchema>;

export const clubPositionCoverageQuerySchema = z.object({
  eraId: z.string().optional(),
});
export type ClubPositionCoverageQueryDto = z.infer<typeof clubPositionCoverageQuerySchema>;

export const playerSeasonFilterSchema = z.object({
  eraId: z.string().optional(),
  leagueIds: commaList,
  clubSeasonId: z.string().optional(),
  positions: commaList,
  /** "prime" swaps in each player's career-best season's rating/attributes, keeping the drawn club-season as display context. */
  ratingsMode: z.enum(["season", "prime"]).optional(),
});
export type PlayerSeasonFilterDto = z.infer<typeof playerSeasonFilterSchema>;
