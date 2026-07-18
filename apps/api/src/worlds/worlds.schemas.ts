import { z } from "zod";

export const createWorldSchema = z.object({
  eraId: z.string(),
  type: z.enum(["SINGLE", "LEAGUE"]).default("SINGLE"),
});
export type CreateWorldDto = z.infer<typeof createWorldSchema>;
