import { z } from "zod";
import { position } from "./attributes.js";

export const formation = z.enum([
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "4-5-1",
  "3-4-3",
  "5-3-2",
  "4-1-4-1",
  "4-4-1-1",
  "3-4-2-1",
  "4-1-2-1-2",
  "4-2-2-2",
]);
export type Formation = z.infer<typeof formation>;

export const mentality = z.enum([
  "very-defensive",
  "defensive",
  "balanced",
  "attacking",
  "very-attacking",
]);
export type Mentality = z.infer<typeof mentality>;

export const tactics = z.object({
  mentality: mentality.default("balanced"),
  tempo: z.enum(["slow", "balanced", "fast"]).default("balanced"),
  width: z.enum(["narrow", "balanced", "wide"]).default("balanced"),
  pressing: z.enum(["low", "medium", "high"]).default("medium"),
  passingStyle: z.enum(["short", "mixed", "direct"]).default("mixed"),
  managerPhilosophy: z
    .enum(["possession", "counter-attack", "gegenpress", "direct-play", "park-the-bus"])
    .optional(),
});
export type Tactics = z.infer<typeof tactics>;

export const squadSlot = z.object({
  position,
  playerId: z.string(),
});
export type SquadSlot = z.infer<typeof squadSlot>;
