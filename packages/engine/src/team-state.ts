import type { MatchTeamSetup, Position, SquadPlayer, Tactics, Weather } from "@futbol/domain";
import {
  applyHomeAdvantage,
  applyTactics,
  applyWeather,
  computePlayerQuality,
  computeUnitRatings,
  dynamicMultiplier,
  type UnitRatings,
} from "./strength.js";
import { POSITION_UNIT_WEIGHTS } from "./positions.js";
import { randomIndex, weightedPick, type Rng } from "./rng.js";
import type { EmitFn } from "./events.js";
import { MAX_SUBS } from "./constants.js";

export interface Contribution {
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  enteredMinute: number;
  subbedOffMinute?: number;
}

export interface TeamState {
  clubId: string;
  isHome: boolean;
  neutralVenue: boolean;
  weather: Weather;
  tactics: Tactics;
  players: Map<string, SquadPlayer>;
  positions: Map<string, Position>;
  benchPositions: Map<string, Position>;
  onPitch: Set<string>;
  bench: string[];
  subsUsed: number;
  score: number;
  shots: number;
  shotsOnTarget: number;
  xgTotal: number;
  possessionUnits: number;
  cardStatus: Map<string, "yellow" | "red">;
  contributions: Map<string, Contribution>;
  rawRatings: UnitRatings;
  baseRatings: UnitRatings;
  enduranceNorm: number;
}

function recomputeBaseRatings(team: TeamState): void {
  const afterTactics = applyTactics(team.rawRatings, team.tactics);
  const afterWeather = applyWeather(afterTactics, team.weather);
  team.baseRatings = applyHomeAdvantage(afterWeather, team.isHome, team.neutralVenue);
}

export function createTeamState(
  setup: MatchTeamSetup,
  weather: Weather,
  neutralVenue: boolean,
): TeamState {
  const players = new Map(setup.squad.players.map((p) => [p.id, p]));
  const positions = new Map<string, Position>();
  const onPitch = new Set<string>();
  const contributions = new Map<string, Contribution>();

  for (const slot of setup.squad.startingXI) {
    positions.set(slot.playerId, slot.position);
    onPitch.add(slot.playerId);
    contributions.set(slot.playerId, { goals: 0, assists: 0, shots: 0, saves: 0, enteredMinute: 0 });
  }

  const bench = setup.squad.substitutes.map((s) => s.playerId);
  const benchPositions = new Map(setup.squad.substitutes.map((s) => [s.playerId, s.position]));

  const startingXIPlayers = setup.squad.startingXI
    .map((slot) => players.get(slot.playerId))
    .filter((p): p is SquadPlayer => p !== undefined);
  const enduranceNorm =
    startingXIPlayers.reduce(
      (sum, p) => sum + (p.attributes.physical.stamina + p.attributes.physical.naturalFitness) / 2 / 20,
      0,
    ) / Math.max(startingXIPlayers.length, 1);

  const team: TeamState = {
    clubId: setup.clubId,
    isHome: setup.isHome,
    neutralVenue,
    weather,
    tactics: { ...setup.tactics },
    players,
    positions,
    benchPositions,
    onPitch,
    bench,
    subsUsed: 0,
    score: 0,
    shots: 0,
    shotsOnTarget: 0,
    xgTotal: 0,
    possessionUnits: 0,
    cardStatus: new Map(),
    contributions,
    rawRatings: computeUnitRatings(setup.squad),
    baseRatings: { attack: 0, creation: 0, defence: 0, goalkeeping: 0 },
    enduranceNorm,
  };
  recomputeBaseRatings(team);
  return team;
}

export function applyMentalityShift(team: TeamState, newMentality: Tactics["mentality"]): void {
  team.tactics = { ...team.tactics, mentality: newMentality };
  recomputeBaseRatings(team);
}

export function findGoalkeeper(team: TeamState): string | undefined {
  for (const pid of team.onPitch) {
    if (team.positions.get(pid) === "GK") return pid;
  }
  return undefined;
}

export function pickShooter(team: TeamState, rng: Rng): string {
  const candidates = [...team.onPitch].filter((pid) => team.positions.get(pid) !== "GK");
  const weights = candidates.map((pid) => {
    const pos = team.positions.get(pid);
    const player = team.players.get(pid);
    if (!pos || !player) return 0.01;
    const w = POSITION_UNIT_WEIGHTS[pos];
    const quality = computePlayerQuality(player).attack;
    return (w.attack + w.creation * 0.4) * (0.3 + quality);
  });
  return weightedPick(rng, candidates, weights);
}

export function pickAssister(team: TeamState, scorerId: string, rng: Rng): string | undefined {
  const candidates = [...team.onPitch].filter(
    (pid) => pid !== scorerId && team.positions.get(pid) !== "GK",
  );
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((pid) => {
    const pos = team.positions.get(pid);
    const player = team.players.get(pid);
    if (!pos || !player) return 0.01;
    const w = POSITION_UNIT_WEIGHTS[pos];
    const quality = computePlayerQuality(player).creation;
    return (w.creation + 0.05) * (0.3 + quality);
  });
  return weightedPick(rng, candidates, weights);
}

function sendOff(team: TeamState, playerId: string, minute: number): void {
  team.onPitch.delete(playerId);
  const contrib = team.contributions.get(playerId);
  if (contrib && contrib.subbedOffMinute === undefined) contrib.subbedOffMinute = minute;
}

export function bookPlayer(
  team: TeamState,
  playerId: string,
  minute: number,
  isStraightRed: boolean,
  emit: EmitFn,
): void {
  const existing = team.cardStatus.get(playerId);
  if (existing === "red") return;

  if (existing === "yellow") {
    team.cardStatus.set(playerId, "red");
    emit({ type: "card", minute, clubId: team.clubId, playerId, cardType: "second-yellow" });
    sendOff(team, playerId, minute);
    return;
  }

  if (isStraightRed) {
    team.cardStatus.set(playerId, "red");
    emit({ type: "card", minute, clubId: team.clubId, playerId, cardType: "red" });
    sendOff(team, playerId, minute);
    return;
  }

  team.cardStatus.set(playerId, "yellow");
  emit({ type: "card", minute, clubId: team.clubId, playerId, cardType: "yellow" });
}

/** Brings on the next bench player. If `forcedOutgoingId` is set (injury), that player comes off; otherwise the player in the incoming player's position is preferred. */
export function performSubstitution(
  team: TeamState,
  rng: Rng,
  emit: EmitFn,
  minute: number,
  forcedOutgoingId?: string,
): void {
  if (team.subsUsed >= MAX_SUBS || team.bench.length === 0) return;
  if (forcedOutgoingId && !team.onPitch.has(forcedOutgoingId)) return;

  const incomingId = team.bench[0];
  if (!incomingId) return;
  const incomingPos = team.benchPositions.get(incomingId);
  if (!incomingPos) return;

  let outgoingId = forcedOutgoingId;
  if (!outgoingId) {
    for (const pid of team.onPitch) {
      if (team.positions.get(pid) === incomingPos) {
        outgoingId = pid;
        break;
      }
    }
  }
  if (!outgoingId) {
    const candidates = [...team.onPitch].filter((pid) => team.positions.get(pid) !== "GK");
    if (candidates.length === 0) return;
    outgoingId = candidates[randomIndex(rng, candidates.length)];
  }
  if (!outgoingId || !team.onPitch.has(outgoingId)) return;

  team.bench.shift();
  team.onPitch.delete(outgoingId);
  team.onPitch.add(incomingId);
  team.positions.set(incomingId, incomingPos);

  const outContrib = team.contributions.get(outgoingId);
  if (outContrib && outContrib.subbedOffMinute === undefined) outContrib.subbedOffMinute = minute;
  if (!team.contributions.has(incomingId)) {
    team.contributions.set(incomingId, { goals: 0, assists: 0, shots: 0, saves: 0, enteredMinute: minute });
  }
  team.subsUsed += 1;
  emit({ type: "substitution", minute, clubId: team.clubId, playerOffId: outgoingId, playerOnId: incomingId });
}

export { dynamicMultiplier };
