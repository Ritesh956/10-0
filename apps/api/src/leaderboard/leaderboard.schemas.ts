import { z } from "zod";

export const submitLeaderboardSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(2)
    .max(24),
  // Self-reported Setup/Draft config the backend never otherwise persists (DraftContext-only) —
  // everything competitively meaningful (formation, standings, squad overall) is re-derived
  // server-side in the service, not taken from this body. See the LeaderboardEntry schema comment.
  difficulty: z.enum(["easy", "normal", "hard"]),
  ratingsMode: z.enum(["season", "prime"]),
});
export type SubmitLeaderboardDto = z.infer<typeof submitLeaderboardSchema>;

export const leaderboardQuerySchema = z.object({
  mode: z.string().optional(),
  difficulty: z.enum(["easy", "normal", "hard"]).optional(),
  ratingsMode: z.enum(["season", "prime"]).optional(),
  formation: z.string().optional(),
  leagueName: z.string().optional(),
  /** Scopes to one real club's runs (Phase 7's per-club leaderboard) — only meaningful alongside
      mode="one-club", but not enforced together since a stray refClubId with mode="solo" just
      matches nothing (solo runs never set refClubId) rather than needing its own validation error. */
  refClubId: z.string().optional(),
  timeWindow: z.enum(["today", "week", "all"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type LeaderboardQueryDto = z.infer<typeof leaderboardQuerySchema>;
