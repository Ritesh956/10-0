import { z } from "zod";

export const createSeasonSchema = z.object({
  competitionName: z.string().min(2).max(60).default("Sample Top Flight"),
  /** Total clubs in the league, including the user's drafted one — the rest are AI-filled. */
  size: z.number().int().min(2).max(20).default(8),
});
export type CreateSeasonDto = z.infer<typeof createSeasonSchema>;
