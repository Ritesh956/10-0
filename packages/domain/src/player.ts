import { z } from "zod";
import { playerAttributes, position, trait } from "./attributes.js";

/**
 * A player's attributes as they were in one specific season — the draftable
 * atom of the whole game ("Henry 2004"). Immutable reference data.
 */
export const playerSeason = z.object({
  id: z.string(),
  playerId: z.string(),
  name: z.string(),
  nationality: z.string(),
  dateOfBirth: z.string(), // ISO date
  seasonYear: z.number().int(),
  clubSeasonId: z.string(),
  positions: z.array(position).min(1),
  preferredFoot: z.enum(["left", "right", "both"]),
  weakFoot: z.number().int().min(1).max(5),
  attributes: playerAttributes,
  overall: z.number().int().min(1).max(99),
  potential: z.number().int().min(1).max(99),
  traits: z.array(trait).default([]),
});
export type PlayerSeason = z.infer<typeof playerSeason>;

/**
 * A player instantiated inside a world/save. Starts as a snapshot of a
 * PlayerSeason's attributes, then diverges as it plays, trains, ages, etc.
 * Dynamic fields are normalized 0-1 with 0.5 (or 1 for fitness/sharpness)
 * as the neutral baseline; the engine interprets them as multipliers.
 */
export const squadPlayer = z.object({
  id: z.string(),
  refPlayerSeasonId: z.string(),
  name: z.string(),
  age: z.number().int().min(15).max(45),
  positions: z.array(position).min(1),
  preferredFoot: z.enum(["left", "right", "both"]),
  weakFoot: z.number().int().min(1).max(5),
  attributes: playerAttributes,
  overall: z.number().int().min(1).max(99),
  potential: z.number().int().min(1).max(99),
  traits: z.array(trait).default([]),
  /** 1 = fully fit, 0 = unable to play. */
  fitness: z.number().min(0).max(1).default(1),
  /** 0 = devastated, 0.5 = neutral, 1 = ecstatic. */
  morale: z.number().min(0).max(1).default(0.5),
  /** 0 = out of form, 0.5 = average, 1 = career-best form. */
  form: z.number().min(0).max(1).default(0.5),
  /** Match sharpness from recent minutes played; 1 = fully sharp. */
  sharpness: z.number().min(0).max(1).default(1),
});
export type SquadPlayer = z.infer<typeof squadPlayer>;
