import { z } from "zod";

/** FM-style 1-20 attribute scale. */
export const attributeValue = z.number().int().min(1).max(20);

export const technicalAttributes = z.object({
  corners: attributeValue,
  crossing: attributeValue,
  dribbling: attributeValue,
  finishing: attributeValue,
  firstTouch: attributeValue,
  freeKicks: attributeValue,
  heading: attributeValue,
  longShots: attributeValue,
  longThrows: attributeValue,
  marking: attributeValue,
  passing: attributeValue,
  penalties: attributeValue,
  tackling: attributeValue,
  technique: attributeValue,
});
export type TechnicalAttributes = z.infer<typeof technicalAttributes>;

export const mentalAttributes = z.object({
  aggression: attributeValue,
  anticipation: attributeValue,
  bravery: attributeValue,
  composure: attributeValue,
  concentration: attributeValue,
  decisions: attributeValue,
  determination: attributeValue,
  flair: attributeValue,
  leadership: attributeValue,
  offTheBall: attributeValue,
  positioning: attributeValue,
  teamwork: attributeValue,
  vision: attributeValue,
  workRate: attributeValue,
});
export type MentalAttributes = z.infer<typeof mentalAttributes>;

export const physicalAttributes = z.object({
  acceleration: attributeValue,
  agility: attributeValue,
  balance: attributeValue,
  jumping: attributeValue,
  naturalFitness: attributeValue,
  pace: attributeValue,
  stamina: attributeValue,
  strength: attributeValue,
});
export type PhysicalAttributes = z.infer<typeof physicalAttributes>;

/** Only meaningful for goalkeepers; outfield players carry low baseline values. */
export const goalkeepingAttributes = z.object({
  aerialAbility: attributeValue,
  commandOfArea: attributeValue,
  communication: attributeValue,
  eccentricity: attributeValue,
  handling: attributeValue,
  kicking: attributeValue,
  oneOnOnes: attributeValue,
  reflexes: attributeValue,
  rushingOut: attributeValue,
  throwing: attributeValue,
});
export type GoalkeepingAttributes = z.infer<typeof goalkeepingAttributes>;

export const playerAttributes = z.object({
  technical: technicalAttributes,
  mental: mentalAttributes,
  physical: physicalAttributes,
  goalkeeping: goalkeepingAttributes,
});
export type PlayerAttributes = z.infer<typeof playerAttributes>;

export const position = z.enum([
  "GK",
  "CB",
  "LB",
  "RB",
  "LWB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
]);
export type Position = z.infer<typeof position>;

export const trait = z.enum([
  "playmaker",
  "poacher",
  "target-man",
  "ball-playing-defender",
  "sweeper-keeper",
  "engine",
  "leader",
  "consistent",
  "big-game-player",
  "injury-prone",
  "early-developer",
  "late-developer",
  "temperamental",
  "loyal",
  "ambitious",
]);
export type Trait = z.infer<typeof trait>;
