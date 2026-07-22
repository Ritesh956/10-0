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
  /** Nations Trophy mode (Phase 10): scopes the pool to only club-seasons that have at least one
      RefPlayerSeason whose player.nationality matches — a pool-scoping pre-filter (unlike Daily
      Challenge's nationality *theme*, which merely checks membership against the full catalog), so
      the wheel never lands on a club with zero eligible players, the same "no dead spin" reasoning
      as clubId. Independent of clubId — the two are never set together. */
  nationality: z.string().optional(),
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
  /** Nations Trophy mode: filters the drawn club-season's squad down to only players of this
      nationality — nationality lives on RefPlayer (season-independent), so this stays correct even
      when combined with ratingsMode="prime" (unlike One-Club, Prime is safe for Nations since a
      player's nationality never changes between their drawn season and their career-best one). */
  nationality: z.string().optional(),
});
export type PlayerSeasonFilterDto = z.infer<typeof playerSeasonFilterSchema>;
