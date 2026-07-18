import { z } from "zod";
import { squad } from "./squad.js";
import { tactics } from "./tactics.js";

export const weather = z.enum(["clear", "rain", "snow", "wind", "extreme-heat"]);
export type Weather = z.infer<typeof weather>;

export const matchImportance = z.enum(["friendly", "league", "cup", "derby", "final"]);
export type MatchImportance = z.infer<typeof matchImportance>;

export const matchTeamSetup = z.object({
  clubId: z.string(),
  squad,
  tactics,
  isHome: z.boolean(),
});
export type MatchTeamSetup = z.infer<typeof matchTeamSetup>;

/**
 * Everything the engine needs to simulate one match. Combined with a seed,
 * this is the full input to the pure `simulate(setup, seed)` contract.
 */
export const matchSetup = z.object({
  matchId: z.string(),
  worldId: z.string(),
  home: matchTeamSetup,
  away: matchTeamSetup,
  weather: weather.default("clear"),
  importance: matchImportance.default("league"),
  neutralVenue: z.boolean().default(false),
  /** 0 = no rivalry, 1 = fiercest derby. Feeds into pressure/variance. */
  rivalryIntensity: z.number().min(0).max(1).default(0),
});
export type MatchSetup = z.infer<typeof matchSetup>;

const baseEvent = {
  seq: z.number().int().nonnegative(),
  minute: z.number().int().min(0).max(120),
  clubId: z.string().optional(),
  playerId: z.string().optional(),
};

export const matchEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kickoff"), ...baseEvent }),
  z.object({
    type: z.literal("possession-phase"),
    phase: z.enum(["build-up", "midfield", "final-third"]),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("shot"),
    xg: z.number().min(0).max(1),
    onTarget: z.boolean(),
    outcome: z.enum(["goal", "saved", "blocked", "off-target"]),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("goal"),
    assistPlayerId: z.string().optional(),
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
    ...baseEvent,
  }),
  z.object({ type: z.literal("save"), goalkeeperId: z.string(), ...baseEvent }),
  z.object({ type: z.literal("foul"), fouledPlayerId: z.string().optional(), ...baseEvent }),
  z.object({
    type: z.literal("card"),
    cardType: z.enum(["yellow", "red", "second-yellow"]),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("injury"),
    severity: z.enum(["minor", "moderate", "severe"]),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("substitution"),
    playerOffId: z.string(),
    playerOnId: z.string(),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("tactical-change"),
    newTactics: tactics.partial(),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("half-time"),
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
    ...baseEvent,
  }),
  z.object({
    type: z.literal("full-time"),
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
    ...baseEvent,
  }),
]);
export type MatchEvent = z.infer<typeof matchEvent>;

export const playerMatchStat = z.object({
  playerId: z.string(),
  rating: z.number().min(0).max(10),
  goals: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  shots: z.number().int().nonnegative(),
  passesCompleted: z.number().int().nonnegative(),
  tackles: z.number().int().nonnegative(),
  minutesPlayed: z.number().int().min(0).max(120),
});
export type PlayerMatchStat = z.infer<typeof playerMatchStat>;

/**
 * Output of `simulate(setup, seed)`. Persisting `seed` + `engineVersion`
 * alongside the result is what makes it reproducible and auditable.
 */
export const matchResult = z.object({
  matchId: z.string(),
  seed: z.string(),
  engineVersion: z.string(),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  homeXg: z.number().nonnegative(),
  awayXg: z.number().nonnegative(),
  homePossession: z.number().min(0).max(1),
  awayPossession: z.number().min(0).max(1),
  playerStats: z.array(playerMatchStat),
  events: z.array(matchEvent),
});
export type MatchResult = z.infer<typeof matchResult>;
