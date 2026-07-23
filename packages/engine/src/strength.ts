import type { MatchImportance, Mentality, Squad, SquadPlayer, Tactics, Weather } from "@futbol/domain";
import { POSITION_UNIT_WEIGHTS } from "./positions.js";

export interface UnitRatings {
  attack: number;
  creation: number;
  defence: number;
  goalkeeping: number;
}

export interface PlayerQuality {
  attack: number;
  creation: number;
  defence: number;
  goalkeeping: number;
}

function avg20(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length / 20;
}

/** Raw per-player quality in each dimension, normalized to roughly 0-1. */
export function computePlayerQuality(p: SquadPlayer): PlayerQuality {
  const t = p.attributes.technical;
  const m = p.attributes.mental;
  const ph = p.attributes.physical;
  const gk = p.attributes.goalkeeping;

  return {
    attack: avg20([t.finishing, t.dribbling, t.technique, m.offTheBall, m.composure, ph.pace]),
    creation: avg20([t.passing, m.vision, t.technique, m.decisions, m.teamwork, t.firstTouch]),
    defence: avg20([
      t.tackling,
      t.marking,
      m.positioning,
      m.anticipation,
      ph.strength,
      (m.aggression + m.bravery) / 2,
    ]),
    goalkeeping: avg20([gk.handling, gk.reflexes, gk.oneOnOnes, gk.aerialAbility, gk.commandOfArea, gk.communication]),
  };
}

/** Fitness/form/morale/sharpness collapsed into one multiplier; 1.0 at all-neutral defaults. */
export function dynamicMultiplier(p: SquadPlayer): number {
  const formFactor = 0.7 + 0.6 * p.form;
  const moraleFactor = 0.85 + 0.3 * p.morale;
  return p.fitness * p.sharpness * formFactor * moraleFactor;
}

const DIMENSIONS = ["attack", "creation", "defence", "goalkeeping"] as const;

/** Aggregates the starting XI into the four tactical unit ratings for a squad. */
export function computeUnitRatings(squad: Squad): UnitRatings {
  const totals: UnitRatings = { attack: 0, creation: 0, defence: 0, goalkeeping: 0 };
  const weightTotals: UnitRatings = { attack: 0, creation: 0, defence: 0, goalkeeping: 0 };

  for (const slot of squad.startingXI) {
    const player = squad.players.find((pl) => pl.id === slot.playerId);
    if (!player) {
      throw new Error(`Player ${slot.playerId} not found in squad ${squad.id} roster`);
    }
    const quality = computePlayerQuality(player);
    const mult = dynamicMultiplier(player);
    const weights = POSITION_UNIT_WEIGHTS[slot.position];

    for (const dim of DIMENSIONS) {
      const w = weights[dim];
      if (w > 0) {
        totals[dim] += quality[dim] * mult * w;
        weightTotals[dim] += w;
      }
    }
  }

  const FALLBACK = 0.3; // guards against a unit with no contributing players (malformed squad)
  return {
    attack: weightTotals.attack > 0 ? totals.attack / weightTotals.attack : FALLBACK,
    creation: weightTotals.creation > 0 ? totals.creation / weightTotals.creation : FALLBACK,
    defence: weightTotals.defence > 0 ? totals.defence / weightTotals.defence : FALLBACK,
    goalkeeping: weightTotals.goalkeeping > 0 ? totals.goalkeeping / weightTotals.goalkeeping : FALLBACK,
  };
}

const MENTALITY_MODIFIERS: Record<Mentality, { attack: number; defence: number }> = {
  "very-defensive": { attack: 0.82, defence: 1.18 },
  defensive: { attack: 0.92, defence: 1.08 },
  balanced: { attack: 1, defence: 1 },
  attacking: { attack: 1.08, defence: 0.92 },
  "very-attacking": { attack: 1.18, defence: 0.82 },
};

/** Wide play trades defensive solidity for creation; narrow is the inverse. */
const WIDTH_MODIFIERS: Record<Tactics["width"], { creation: number; defence: number }> = {
  narrow: { creation: 0.95, defence: 1.05 },
  balanced: { creation: 1, defence: 1 },
  wide: { creation: 1.06, defence: 0.96 },
};

/** Short/possession passing trades directness for creation reliability; direct is the inverse. */
const PASSING_STYLE_MODIFIERS: Record<Tactics["passingStyle"], { creation: number; attack: number }> = {
  short: { creation: 1.06, attack: 0.97 },
  mixed: { creation: 1, attack: 1 },
  direct: { creation: 0.94, attack: 1.05 },
};

/** Shifts unit ratings per the manager's chosen mentality/width/passing style. */
export function applyTactics(ratings: UnitRatings, tactics: Tactics): UnitRatings {
  const mentalityMod = MENTALITY_MODIFIERS[tactics.mentality];
  const widthMod = WIDTH_MODIFIERS[tactics.width];
  const passingMod = PASSING_STYLE_MODIFIERS[tactics.passingStyle];
  return {
    ...ratings,
    attack: ratings.attack * mentalityMod.attack * passingMod.attack,
    creation: ratings.creation * widthMod.creation * passingMod.creation,
    defence: ratings.defence * mentalityMod.defence * widthMod.defence,
  };
}

// Amplified by CHANCE_QUALITY_EXPONENT along with every other rating edge, so a smaller raw factor
// than the pre-exponent 0.08 now lands the even-match home-win rate at a realistic ~45%.
export const HOME_ADVANTAGE = 0.05;

/** Applies the well-documented home-field boost to attack/creation/defence. */
export function applyHomeAdvantage(ratings: UnitRatings, isHome: boolean, neutralVenue: boolean): UnitRatings {
  if (!isHome || neutralVenue) return ratings;
  const factor = 1 + HOME_ADVANTAGE;
  return {
    ...ratings,
    attack: ratings.attack * factor,
    creation: ratings.creation * factor,
    defence: ratings.defence * factor,
  };
}

const WEATHER_TECHNICAL_FACTOR: Record<Weather, number> = {
  clear: 1,
  rain: 0.94,
  snow: 0.9,
  wind: 0.96,
  "extreme-heat": 0.95,
};

/** Poor conditions blunt technical/creative play more than raw physicality. */
export function applyWeather(ratings: UnitRatings, weather: Weather): UnitRatings {
  const factor = WEATHER_TECHNICAL_FACTOR[weather];
  return {
    ...ratings,
    attack: ratings.attack * factor,
    creation: ratings.creation * factor,
  };
}

const IMPORTANCE_VARIANCE: Record<MatchImportance, number> = {
  friendly: 0.9,
  league: 1,
  cup: 1.05,
  derby: 1.15,
  final: 1.2,
};

/** Higher-stakes matches swing more on luck/pressure, not just quality. */
export function varianceMultiplier(importance: MatchImportance, rivalryIntensity: number): number {
  return IMPORTANCE_VARIANCE[importance] * (1 + rivalryIntensity * 0.25);
}
