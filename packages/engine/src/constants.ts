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
