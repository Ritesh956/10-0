import { z } from "zod";

export const createSeasonSchema = z.object({
  competitionName: z.string().min(2).max(60).default("Sample Top Flight"),
  /** Total clubs in the league, including already-drafted ones — used only when leagueId is
      omitted (e.g. multiplayer's fixed 2-club head-to-head, which needs no AI-fill at all). */
  size: z.number().int().min(2).max(20).default(8),
  /** When given, AI-filled clubs are exactly this real league's actual current clubs (at their
      most recent season year) instead of an arbitrary cross-league grab-bag, and their count
      determines the season's total size on its own, overriding `size`. */
  leagueId: z.string().optional(),
});
export type CreateSeasonDto = z.infer<typeof createSeasonSchema>;

export const simulateSeasonSchema = z
  .object({
    /** Stop after this matchday instead of simulating every remaining fixture — used to pause a
        domestic season at its halfway point for the January Transfer Window. Omitted body ⇒ {}. */
    throughMatchday: z.number().int().positive().optional(),
  })
  .optional()
  .default({});
export type SimulateSeasonDto = z.infer<typeof simulateSeasonSchema>;
