import type { PlayerMatchStat } from "@futbol/domain";
import { POSITION_UNIT_WEIGHTS } from "./positions.js";
import { uniform, type Rng } from "./rng.js";
import type { UnitRatings } from "./strength.js";
import type { TeamState } from "./team-state.js";
import { clamp, hashToUnit, round1 } from "./util.js";

/**
 * The engine doesn't simulate individual passes/tackles minute-by-minute;
 * instead it distributes team-level totals across players by position
 * weight and minutes played, with a touch of seeded noise per player.
 */
export function computePlayerStats(
  matchId: string,
  team: TeamState,
  opponentScore: number,
  ratings: UnitRatings,
  rng: Rng,
): PlayerMatchStat[] {
  const entries = [...team.contributions.entries()].filter(([, c]) => {
    const minutesPlayed = (c.subbedOffMinute ?? 90) - c.enteredMinute;
    return minutesPlayed > 0;
  });
  if (entries.length === 0) return [];

  const totalPasses = Math.round(380 + ratings.creation * 220);
  const totalTackles = Math.round(10 + ratings.defence * 10);

  const minuteShare = (playerId: string, c: (typeof entries)[number][1]): number => {
    const minutesPlayed = (c.subbedOffMinute ?? 90) - c.enteredMinute;
    return minutesPlayed / 90;
  };

  const passWeights = entries.map(([playerId, c]) => {
    const pos = team.positions.get(playerId);
    const w = pos ? POSITION_UNIT_WEIGHTS[pos].creation + 0.1 : 0.1;
    return w * minuteShare(playerId, c) * uniform(rng, 0.85, 1.15);
  });
  const tackleWeights = entries.map(([playerId, c]) => {
    const pos = team.positions.get(playerId);
    const w = pos ? POSITION_UNIT_WEIGHTS[pos].defence + 0.05 : 0.05;
    return w * minuteShare(playerId, c) * uniform(rng, 0.85, 1.15);
  });

  const passWeightSum = passWeights.reduce((s, w) => s + w, 0) || 1;
  const tackleWeightSum = tackleWeights.reduce((s, w) => s + w, 0) || 1;

  return entries.map(([playerId, c], i) => {
    const minutesPlayed = Math.min(90, (c.subbedOffMinute ?? 90) - c.enteredMinute);
    const passesCompleted = Math.round(((passWeights[i] ?? 0) / passWeightSum) * totalPasses);
    const tackles = Math.round(((tackleWeights[i] ?? 0) / tackleWeightSum) * totalTackles);

    let rating = 6.0;
    rating += c.goals * 1.0;
    rating += c.assists * 0.7;
    rating += c.saves * 0.12;
    rating += team.score > opponentScore ? 0.3 : team.score < opponentScore ? -0.3 : 0;
    rating += (hashToUnit(playerId + matchId) - 0.5) * 0.6;
    rating = clamp(rating, 4.0, 9.8);

    return {
      playerId,
      rating: round1(rating),
      goals: c.goals,
      assists: c.assists,
      shots: c.shots,
      passesCompleted,
      tackles,
      minutesPlayed,
    };
  });
}
