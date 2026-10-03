/** Tuning knobs for the match simulation. `tools/sim-lab` calibrates these against realistic statistical targets. */
export const BASE_CHANCE_RATE = 0.105;
/**
 * How sharply a quality edge converts to a chance-creation edge. The shot-volume share is
 * `offense^k / (offense^k + defense^k)`: at equal quality it's always 0.5 (so the even-match
 * calibration is untouched by k), but k>1 amplifies real quality gaps. Tuned so a full 380-game
 * league season produces a realistic table (champion ~86-90 pts, not a compressed ~75) and the
 * strongest squad reliably — but not always — wins, rather than quality washing out over 38 games.
 */
export const CHANCE_QUALITY_EXPONENT = 2.4;
/** Weight of the quality delta on shot quality (xG). Higher => stronger sides convert better. */
export const XG_QUALITY_WEIGHT = 0.32;
/** Weight of the quality delta on getting a shot on target. */
export const ONTARGET_QUALITY_WEIGHT = 0.38;
/**
 * GK quality (after the fitness multiplier) at which a keeper neither helps nor hurts the base save
 * rate. The save formula is the one place the engine uses an absolute quality level rather than a
 * delta/ratio, so this pivot has to sit near a typical real keeper's quality: it was 0.5 when catalog
 * ratings mapped to quality ~0.7-1.0, and moved to 0.36 when the OVR curve and quality slope were
 * re-fitted (2026-10, see packages/engine/src/testing/rating-scale.ts) so goals/game stay ~2.6-3.0.
 */
export const GK_SAVE_PIVOT = 0.36;
export const FATIGUE_MAX = 0.18;
export const MOMENTUM_DECAY = 0.92;
export const MOMENTUM_BOOST_WEIGHT = 0.12;
export const MOMENTUM_GOAL_SWING = 0.45;
export const MOMENTUM_SAVE_SWING = 0.08;
export const BASE_FOUL_RATE = 0.12;
export const CARD_PROBABILITY_ON_FOUL = 0.15;
export const STRAIGHT_RED_PROBABILITY = 0.08;
export const BASE_INJURY_RATE = 0.0008;
export const INJURY_PRONE_MULTIPLIER = 2.0;
export const MAX_SUBS = 3;
export const SUB_WINDOWS = [60, 70, 80];
export const UNASSISTED_GOAL_PROBABILITY = 0.25;
