import { z } from "zod";

export const worldSettingsSchema = z.object({
  europeanNights: z.boolean().default(true),
  januaryWindow: z.boolean().default(true),
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
