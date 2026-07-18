import { z } from "zod";

export const club = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  badgeRef: z.string().optional(),
});
export type Club = z.infer<typeof club>;

/** One club's instance in one season within an era — e.g. "Barcelona 2009". */
export const clubSeason = z.object({
  id: z.string(),
  clubId: z.string(),
  seasonYear: z.number().int(),
  leagueId: z.string(),
  reputation: z.number().int().min(1).max(100),
});
export type ClubSeason = z.infer<typeof clubSeason>;

export const league = z.object({
  id: z.string(),
  eraId: z.string(),
  name: z.string(),
  country: z.string(),
  tier: z.number().int().positive().default(1),
});
export type League = z.infer<typeof league>;

export const era = z.object({
  id: z.string(),
  name: z.string(),
  startYear: z.number().int(),
  endYear: z.number().int(),
});
export type Era = z.infer<typeof era>;
