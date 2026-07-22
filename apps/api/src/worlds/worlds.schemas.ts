import { z } from "zod";

export const worldSettingsSchema = z.object({
  europeanNights: z.boolean().default(true),
  januaryWindow: z.boolean().default(true),
  /** Phase 7 (One-Club XI): the RefClub id this world's draft was locked to, or omitted for a
      normal fantasy-XI world. Set once at world creation, read server-side (never client-supplied)
      wherever a run needs to know it was a one-club draft — currently just LeaderboardService's
      submitRun, which derives mode/refClubId from this instead of trusting the submission body. */
  oneClubClubId: z.string().optional(),
  /** Phase 9a (async multiplayer Leagues): the MultiplayerLeague this world's draft belongs to, or
      omitted for a normal solo world. Set once at world creation; WorldsService.createWorld uses it
      to attach the caller's LeagueMembership.worldId server-side (implicitly joining the league if
      the caller hadn't already, harmless since membership is idempotent) — never trusted beyond
      that, same "derive from World.settings" pattern as oneClubClubId. */
  multiplayerLeagueId: z.string().optional(),
  /** Phase 10 (Nations Trophy): the RefPlayer.nationality string this world's draft was locked to,
      or omitted for a normal world — same "set once at world creation, read server-side, never
      client-supplied at submission time" pattern as oneClubClubId. Drives LeaderboardService's
      mode="nations" derivation and SeasonsService.finalizeRun's nationsLocked flag for the
      "nations-champion" trophy. The nationality string itself doubles as the id (there's no
      separate Nation model), same as how clubName/refClubId aren't unified in One-Club either. */
  nationsNationality: z.string().optional(),
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
