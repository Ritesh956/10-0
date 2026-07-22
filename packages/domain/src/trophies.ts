import { z } from "zod";

/** Shared key set for the trophy/Achievement system (Phase 5) — the API evaluates and persists
    these keys as Achievement.key; apps/web hand-mirrors the same string literals into its own
    api/types.ts (per its zero-workspace-deps convention) to drive a purely-display trophy catalog
    (name/description/icon) keyed by the same strings. */
export const trophyKey = z.enum([
  "invincible",
  "unbeaten",
  "champions",
  "golden-boot",
  "playmaker",
  "golden-glove",
  "mvp",
  // Phase 7 (One-Club XI) — evaluated at leaderboard-submission time against prior LeaderboardEntry
  // rows for the same refClubId, not by trophy-evaluation.ts's per-run evaluateTrophies (see
  // leaderboard.logic.ts's evaluateClubRecordTrophies). Real per-season historical standings don't
  // exist anywhere in our dataset (RefClubSeason has no points/table data), so these benchmark
  // against prior *simulated* runs for the club within this game, not real-world history.
  "club-record-breaker",
  "club-worst-ever",
]);
export type TrophyKey = z.infer<typeof trophyKey>;
