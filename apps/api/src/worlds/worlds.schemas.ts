import { z } from "zod";

export const worldSettingsSchema = z.object({
  europeanNights: z.boolean().default(true),
  januaryWindow: z.boolean().default(true),
  /** Phase 7 (One-Club XI): the RefClub id this world's draft was locked to, or omitted for a
      normal fantasy-XI world. Set once at world creation, read server-side (never client-supplied)
      wherever a run needs to know it was a one-club draft — currently just LeaderboardService's
      submitRun, which derives mode/refClubId from this instead of trusting the submission body. */
  oneClubClubId: z.string().optional(),
});
export type WorldSettingsDto = z.infer<typeof worldSettingsSchema>;

export const createWorldSchema = z.object({
  eraId: z.string(),
  type: z.enum(["SINGLE", "LEAGUE"]).default("SINGLE"),
  // .default(...) on a nested object schema substitutes the literal default value without
  // re-parsing it through worldSettingsSchema, so the default must already include every field.
  settings: worldSettingsSchema.default({ europeanNights: true, januaryWindow: true }),
});
export type CreateWorldDto = z.infer<typeof createWorldSchema>;
