import { z } from "zod";

export const submitDailyAttemptSchema = z.object({
  handle: z.string().trim().min(2).max(24),
  /** The full 11-player squad, including the anchor's own RefPlayerSeason id exactly once —
      daily.service.ts strips the anchor back out before scoring the remaining picks against
      the puzzle's constraints. */
  picks: z.array(z.string()).length(11),
});
export type SubmitDailyAttemptDto = z.infer<typeof submitDailyAttemptSchema>;

export const dailyLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type DailyLeaderboardQueryDto = z.infer<typeof dailyLeaderboardQuerySchema>;
