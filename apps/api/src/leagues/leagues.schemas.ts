import { z } from "zod";

/** The shared draft/season rules a league's creator locks in once — see 38-0's "same rules for
    everyone" framing. Mirrors the subset of DraftConfig (apps/web/src/state/DraftContext.tsx) that
    actually needs to be identical across members; ratings visibility, draft mode, managers, and the
    European Nights/January toggles stay each member's own free choice. */
export const createLeagueSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    eraId: z.string(),
    leagueIds: z.array(z.string()).min(1),
    difficulty: z.enum(["easy", "normal", "hard"]),
    formationFreedom: z.boolean(),
    formation: z.string().optional(),
  })
  .refine((v) => v.formationFreedom || Boolean(v.formation), {
    message: "formation is required when formationFreedom is false",
    path: ["formation"],
  });
export type CreateLeagueDto = z.infer<typeof createLeagueSchema>;

export interface LeagueRules {
  eraId: string;
  leagueIds: string[];
  difficulty: "easy" | "normal" | "hard";
  formationFreedom: boolean;
  formation?: string;
}
