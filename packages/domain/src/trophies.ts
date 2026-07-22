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
]);
export type TrophyKey = z.infer<typeof trophyKey>;
