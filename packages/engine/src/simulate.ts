import type { MatchResult, MatchSetup, Mentality } from "@futbol/domain";
import {
  BASE_CHANCE_RATE,
  BASE_FOUL_RATE,
  BASE_INJURY_RATE,
  CARD_PROBABILITY_ON_FOUL,
  CHANCE_QUALITY_EXPONENT,
  ONTARGET_QUALITY_WEIGHT,
  XG_QUALITY_WEIGHT,
  FATIGUE_MAX,
  INJURY_PRONE_MULTIPLIER,
  MOMENTUM_BOOST_WEIGHT,
  MOMENTUM_DECAY,
  MOMENTUM_GOAL_SWING,
  MOMENTUM_SAVE_SWING,
  STRAIGHT_RED_PROBABILITY,
  SUB_WINDOWS,
  UNASSISTED_GOAL_PROBABILITY,
} from "./constants.js";
import { createEmitter, type EmitFn } from "./events.js";
import { computePlayerStats } from "./ratings.js";
import { createRng, weightedPick, type Rng } from "./rng.js";
import { dynamicMultiplier, varianceMultiplier, computePlayerQuality, type UnitRatings } from "./strength.js";
import {
  applyMentalityShift,
  bookPlayer,
  createTeamState,
  findGoalkeeper,
  performSubstitution,
  pickAssister,
  pickShooter,
  type TeamState,
} from "./team-state.js";
import { clamp, round2 } from "./util.js";
import { ENGINE_VERSION } from "./version.js";

const MENTALITY_LADDER: Mentality[] = [
  "very-defensive",
  "defensive",
  "balanced",
  "attacking",
  "very-attacking",
];

function liveRatings(team: TeamState, minute: number): UnitRatings {
  const tempoFactor = team.tactics.tempo === "fast" ? 1.15 : team.tactics.tempo === "slow" ? 0.9 : 1;
  const pressFactor = team.tactics.pressing === "high" ? 1.15 : team.tactics.pressing === "low" ? 0.9 : 1;
  const fatigueFactor =
    1 - (minute / 90) * FATIGUE_MAX * (1 - team.enduranceNorm) * tempoFactor * pressFactor;
  return {
    attack: team.baseRatings.attack * fatigueFactor,
    creation: team.baseRatings.creation * fatigueFactor,
    defence: team.baseRatings.defence * fatigueFactor,
    goalkeeping: team.baseRatings.goalkeeping,
  };
}

/** Runs one team's attacking sequences for the minute. Returns the momentum swing (unsigned; caller applies sign). */
function processAttack(
  attacker: TeamState,
  defender: TeamState,
  attackerRatings: UnitRatings,
  defenderRatings: UnitRatings,
  momentumForAttacker: number,
  varMult: number,
  rng: Rng,
  emit: EmitFn,
  minute: number,
): number {
  const momentumBoost = 1 + momentumForAttacker * MOMENTUM_BOOST_WEIGHT;
  const offense = (attackerRatings.attack * 0.6 + attackerRatings.creation * 0.4) * momentumBoost;
  const defense = defenderRatings.defence * 0.7 + defenderRatings.goalkeeping * 0.3;

  attacker.possessionUnits += offense;

  // Quality edge → chance-share, steepened by CHANCE_QUALITY_EXPONENT. At equal quality this is
  // exactly 0.5 regardless of the exponent, so the even-strength calibration is unaffected; a real
  // gap is amplified so it compounds into a realistic league table over a full season.
  const ok = Math.pow(offense, CHANCE_QUALITY_EXPONENT);
  const dk = Math.pow(defense, CHANCE_QUALITY_EXPONENT);
  const chanceProb = clamp(BASE_CHANCE_RATE * (ok / (ok + dk)) * 2, 0.02, 0.6);
  if (rng() >= chanceProb) return 0;

  attacker.shots += 1;
  const qualityDelta = offense - defense;
  const xg = clamp(0.28 + XG_QUALITY_WEIGHT * qualityDelta + (rng() - 0.5) * 0.3 * varMult, 0.03, 0.95);
  attacker.xgTotal += xg;

  const shooterId = pickShooter(attacker, rng);
  const shooterContrib = attacker.contributions.get(shooterId);
  if (shooterContrib) shooterContrib.shots += 1;

  const onTargetProb = clamp(0.4 + ONTARGET_QUALITY_WEIGHT * qualityDelta, 0.15, 0.8);
  const onTarget = rng() < onTargetProb;

  if (!onTarget) {
    const outcome = rng() < 0.5 ? "blocked" : "off-target";
    emit({
      type: "shot",
      minute,
      clubId: attacker.clubId,
      playerId: shooterId,
      xg: round2(xg),
      onTarget: false,
      outcome,
    });
    return 0;
  }

  attacker.shotsOnTarget += 1;
  const gkId = findGoalkeeper(defender);
  const gkPlayer = gkId ? defender.players.get(gkId) : undefined;
  const gkQuality = gkPlayer
    ? computePlayerQuality(gkPlayer).goalkeeping * dynamicMultiplier(gkPlayer)
    : 0.5;
  const saveProb = clamp(0.75 - xg * 0.55 + (gkQuality - 0.5) * 0.35, 0.05, 0.95);
  const saved = rng() < saveProb;

  if (saved) {
    emit({
      type: "shot",
      minute,
      clubId: attacker.clubId,
      playerId: shooterId,
      xg: round2(xg),
      onTarget: true,
      outcome: "saved",
    });
    if (gkId) {
      emit({ type: "save", minute, clubId: defender.clubId, playerId: gkId, goalkeeperId: gkId });
      const gkContrib = defender.contributions.get(gkId);
      if (gkContrib) gkContrib.saves += 1;
    }
    return MOMENTUM_SAVE_SWING;
  }

  attacker.score += 1;
  emit({
    type: "shot",
    minute,
    clubId: attacker.clubId,
    playerId: shooterId,
    xg: round2(xg),
    onTarget: true,
    outcome: "goal",
  });
  const assistId = rng() < UNASSISTED_GOAL_PROBABILITY ? undefined : pickAssister(attacker, shooterId, rng);
  if (shooterContrib) shooterContrib.goals += 1;
  if (assistId) {
    const assistContrib = attacker.contributions.get(assistId);
    if (assistContrib) assistContrib.assists += 1;
  }
  emit({
    type: "goal",
    minute,
    clubId: attacker.clubId,
    playerId: shooterId,
    assistPlayerId: assistId,
    homeScore: attacker.isHome ? attacker.score : defender.score,
    awayScore: attacker.isHome ? defender.score : attacker.score,
  });
  return MOMENTUM_GOAL_SWING;
}

function processDiscipline(team: TeamState, rng: Rng, emit: EmitFn, minute: number): void {
  if (rng() >= BASE_FOUL_RATE) return;
  const candidates = [...team.onPitch].filter((pid) => team.positions.get(pid) !== "GK");
  if (candidates.length === 0) return;

  const weights = candidates.map((pid) => team.players.get(pid)?.attributes.mental.aggression ?? 10);
  const playerId = weightedPick(rng, candidates, weights);
  emit({ type: "foul", minute, clubId: team.clubId, playerId });

  if (rng() < CARD_PROBABILITY_ON_FOUL) {
    const isStraightRed = rng() < STRAIGHT_RED_PROBABILITY;
    bookPlayer(team, playerId, minute, isStraightRed, emit);
  }
}

function processInjury(team: TeamState, rng: Rng, emit: EmitFn, minute: number): void {
  const hasInjuryProne = [...team.onPitch].some((pid) =>
    team.players.get(pid)?.traits.includes("injury-prone"),
  );
  const injuryProb = BASE_INJURY_RATE * (hasInjuryProne ? INJURY_PRONE_MULTIPLIER : 1);
  if (rng() >= injuryProb) return;

  const onPitchIds = [...team.onPitch];
  if (onPitchIds.length === 0) return;
  const playerId = onPitchIds[Math.floor(rng() * onPitchIds.length)] ?? onPitchIds[0];
  if (!playerId) return;

  const severityRoll = rng();
  const severity = severityRoll < 0.7 ? "minor" : severityRoll < 0.95 ? "moderate" : "severe";
  emit({ type: "injury", minute, clubId: team.clubId, playerId, severity });

  if (severity !== "minor") {
    performSubstitution(team, rng, emit, minute, playerId);
  }
}

function maybeSubstitute(team: TeamState, rng: Rng, emit: EmitFn, minute: number): void {
  if (!SUB_WINDOWS.includes(minute)) return;
  if (team.subsUsed >= 3 || team.bench.length === 0) return;
  const fatigueLevel = (minute / 90) * (1 - team.enduranceNorm);
  const subProbability = 0.15 + fatigueLevel * 0.5;
  if (rng() < subProbability) {
    performSubstitution(team, rng, emit, minute);
  }
}

function applyHalfTimeTacticalAI(team: TeamState, opponent: TeamState, emit: EmitFn, minute: number): void {
  const losing = team.score < opponent.score;
  const winningBig = team.score >= opponent.score + 2;
  const idx = MENTALITY_LADDER.indexOf(team.tactics.mentality);
  let newIdx = idx;
  if (losing && idx < MENTALITY_LADDER.length - 1) newIdx = idx + 1;
  else if (winningBig && idx > 0) newIdx = idx - 1;
  if (newIdx !== idx) {
    const newMentality = MENTALITY_LADDER[newIdx];
    if (!newMentality) return;
    applyMentalityShift(team, newMentality);
    emit({ type: "tactical-change", minute, clubId: team.clubId, newTactics: { mentality: newMentality } });
  }
}

/**
 * Pure, deterministic match simulation: identical (setup, seed, engine version)
 * always produces an identical result. All randomness flows through the
 * seeded `rng` — never Math.random, never wall-clock time.
 */
export function simulate(setup: MatchSetup, seed: bigint): MatchResult {
  const rng = createRng(seed);
  const events: MatchResult["events"] = [];
  const emit = createEmitter(events);

  const home = createTeamState(setup.home, setup.weather, setup.neutralVenue);
  const away = createTeamState(setup.away, setup.weather, setup.neutralVenue);
  const varMult = varianceMultiplier(setup.importance, setup.rivalryIntensity);

  emit({ type: "kickoff", minute: 0 });

  let momentum = 0; // positive favors home

  for (let minute = 0; minute < 90; minute++) {
    if (minute === 45) {
      emit({ type: "half-time", minute, homeScore: home.score, awayScore: away.score });
      applyHalfTimeTacticalAI(home, away, emit, minute);
      applyHalfTimeTacticalAI(away, home, emit, minute);
    }

    momentum *= MOMENTUM_DECAY;

    const homeRatings = liveRatings(home, minute);
    const awayRatings = liveRatings(away, minute);

    const homeSwing = processAttack(home, away, homeRatings, awayRatings, momentum, varMult, rng, emit, minute);
    momentum += homeSwing;
    const awaySwing = processAttack(away, home, awayRatings, homeRatings, -momentum, varMult, rng, emit, minute);
    momentum -= awaySwing;

    processDiscipline(home, rng, emit, minute);
    processDiscipline(away, rng, emit, minute);
    processInjury(home, rng, emit, minute);
    processInjury(away, rng, emit, minute);
    maybeSubstitute(home, rng, emit, minute);
    maybeSubstitute(away, rng, emit, minute);
  }

  emit({ type: "full-time", minute: 90, homeScore: home.score, awayScore: away.score });

  const totalUnits = home.possessionUnits + away.possessionUnits;
  const homePossession = totalUnits > 0 ? home.possessionUnits / totalUnits : 0.5;

  const homeStats = computePlayerStats(setup.matchId, home, away.score, home.baseRatings, rng);
  const awayStats = computePlayerStats(setup.matchId, away, home.score, away.baseRatings, rng);

  return {
    matchId: setup.matchId,
    seed: seed.toString(),
    engineVersion: ENGINE_VERSION,
    homeScore: home.score,
    awayScore: away.score,
    homeXg: round2(home.xgTotal),
    awayXg: round2(away.xgTotal),
    homePossession: round2(homePossession),
    awayPossession: round2(1 - homePossession),
    playerStats: [...homeStats, ...awayStats],
    events,
  };
}
