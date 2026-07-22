import { z } from "zod";
import { formation } from "@futbol/domain";

/** Same shared-rules shape as leagues.schemas.ts's createLeagueSchema, minus formationFreedom — a
    live draft room always locks one shared formation (see LiveDraftRoom's schema comment on why).
    Reuses @futbol/domain's own formation enum (same as draftFantasySchema) rather than a bare
    string, so a room can never be created with a formation lineup.ts's buildLineup doesn't know. */
export const createLiveDraftRoomSchema = z.object({
  name: z.string().trim().min(2).max(40),
  eraId: z.string(),
  leagueIds: z.array(z.string()).min(1),
  difficulty: z.enum(["easy", "normal", "hard"]),
  formation,
  maxSeats: z.coerce.number().int().min(2).max(4).default(4),
});
export type CreateLiveDraftRoomDto = z.infer<typeof createLiveDraftRoomSchema>;
