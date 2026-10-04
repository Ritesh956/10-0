import { TROPHY_DEFS, type TrophyCategory, type TrophyKey, type TrophyTier } from "@futbol/domain";
import {
  careerProgress,
  CAREER_TROPHIES,
  GOAL_MACHINE_GPG,
  type CareerTrophyKey,
} from "../seasons/trophy-evaluation.js";

export type RunMode = "solo" | "one-club" | "nations" | "league";

/** One world the user drafted, with whatever finalizeRun recorded for it. A run is "finished"
    once it has a points total; the finer stats are null for runs finalized before they were
    recorded (2026-10). */
export interface ProfileRun {
  worldId: string;
  createdAt: Date;
  clubName: string | null;
  formation: string | null;
  leagueId: string | null;
  mode: RunMode;
  finished: boolean;
  points: number | null;
  position: number | null;
  leagueSize: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  squadOverall: number | null;
  longestWinStreak: number | null;
  trophies: string[];
}

export interface RunRef {
  worldId: string;
  clubName: string | null;
  value: number;
}

export interface CareerStats {
  seasonsStarted: number;
  seasonsFinished: number;
  titles: number;
  topFours: number;
  invincibles: number;
  unbeatenSeasons: number;
  europeanTitles: number;
  bestPoints: RunRef | null;
  bestRecord: { worldId: string; clubName: string | null; won: number; drawn: number; lost: number; points: number } | null;
  /** Matches won / played, over runs that recorded W-D-L. */
  winRate: number | null;
  matchesPlayed: number;
  goalsScored: number;
  averageFinish: number | null;
  favouriteFormation: string | null;
  favouriteLeagueId: string | null;
  topRatedXi: RunRef | null;
  bestWinStreak: number | null;
  trophiesEarned: number;
}

const has = (run: ProfileRun, key: TrophyKey) => run.trophies.includes(key);

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

function maxBy<T>(items: T[], score: (item: T) => number | null): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s !== null && s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}

export function computeCareerStats(runs: ProfileRun[], distinctTrophies: number): CareerStats {
  const finished = runs.filter((r) => r.finished);
  const withRecord = finished.filter(
    (r): r is ProfileRun & { won: number; drawn: number; lost: number; points: number } =>
      r.won !== null && r.drawn !== null && r.lost !== null && r.points !== null,
  );
  const played = withRecord.reduce((sum, r) => sum + r.won + r.drawn + r.lost, 0);
  const won = withRecord.reduce((sum, r) => sum + r.won, 0);
  const positions = finished.map((r) => r.position).filter((p): p is number => p !== null);

  const bestPointsRun = maxBy(finished, (r) => r.points);
  const bestRecordRun = maxBy(withRecord, (r) => r.points * 1000 + ((r.goalsFor ?? 0) - (r.goalsAgainst ?? 0)));
  const topXiRun = maxBy(finished, (r) => r.squadOverall);
  const streaks = finished.map((r) => r.longestWinStreak).filter((n): n is number => n !== null);

  return {
    seasonsStarted: runs.length,
    seasonsFinished: finished.length,
    titles: finished.filter((r) => has(r, "champions")).length,
    topFours: finished.filter((r) => has(r, "top-four") || (r.position !== null && r.position <= 4)).length,
    invincibles: finished.filter((r) => has(r, "invincible")).length,
    unbeatenSeasons: finished.filter((r) => has(r, "invincible") || has(r, "unbeaten")).length,
    europeanTitles: finished.filter((r) => has(r, "european-champion")).length,
    bestPoints: bestPointsRun
      ? { worldId: bestPointsRun.worldId, clubName: bestPointsRun.clubName, value: bestPointsRun.points! }
      : null,
    bestRecord: bestRecordRun
      ? {
          worldId: bestRecordRun.worldId,
          clubName: bestRecordRun.clubName,
          won: bestRecordRun.won,
          drawn: bestRecordRun.drawn,
          lost: bestRecordRun.lost,
          points: bestRecordRun.points,
        }
      : null,
    winRate: played > 0 ? won / played : null,
    matchesPlayed: played,
    goalsScored: finished.reduce((sum, r) => sum + (r.goalsFor ?? 0), 0),
    averageFinish: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
    favouriteFormation: mostCommon(finished.map((r) => r.formation)) ?? mostCommon(runs.map((r) => r.formation)),
    favouriteLeagueId: mostCommon(finished.map((r) => r.leagueId)) ?? mostCommon(runs.map((r) => r.leagueId)),
    topRatedXi: topXiRun?.squadOverall != null
      ? { worldId: topXiRun.worldId, clubName: topXiRun.clubName, value: topXiRun.squadOverall }
      : null,
    bestWinStreak: streaks.length > 0 ? Math.max(...streaks) : null,
    trophiesEarned: distinctTrophies,
  };
}

export interface Streak {
  current: number;
  best: number;
}

export interface Streaks {
  /** Consecutive title-winning seasons. */
  titles: Streak;
  /** Consecutive seasons without a league defeat. */
  unbeaten: Streak;
  /** Consecutive seasons each with more points than the one before. */
  onTheUp: Streak;
  /** Consecutive (UTC) days with a finished season; "current" is still alive if the last one was today or yesterday. */
  days: Streak;
}

function runStreak(flags: boolean[]): Streak {
  let current = 0;
  let best = 0;
  for (const f of flags) {
    current = f ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return { current, best };
}

const DAY_MS = 86_400_000;
const utcDay = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export function computeStreaks(runs: ProfileRun[], now: Date): Streaks {
  const finished = runs.filter((r) => r.finished).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const withPoints = finished.filter((r) => r.points !== null);
  const rising: boolean[] = withPoints.map((r, i) => i > 0 && r.points! > withPoints[i - 1]!.points!);
  const onTheUp = runStreak(rising);

  const days = [...new Set(finished.map((r) => utcDay(r.createdAt)))].sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  for (let i = 0; i < days.length; i++) {
    current = i > 0 && days[i]! - days[i - 1]! === 1 ? current + 1 : 1;
    best = Math.max(best, current);
  }
  const last = days[days.length - 1];
  const alive = last !== undefined && utcDay(now) - last <= 1;

  return {
    titles: runStreak(finished.map((r) => has(r, "champions"))),
    unbeaten: runStreak(finished.map((r) => has(r, "invincible") || has(r, "unbeaten"))),
    onTheUp,
    days: { current: alive ? current : 0, best },
  };
}

export interface CabinetEntry {
  key: TrophyKey;
  category: TrophyCategory;
  tier: TrophyTier;
  /** How many runs earned it (career trophies: 0 or 1). */
  count: number;
  firstEarnedAt: Date | null;
  /** The most recent run that earned it. */
  lastWorldId: string | null;
  progress: { current: number; target: number } | null;
  /** Share of players with a finished season who hold it, 0-100; null before anyone has finished one. */
  rarityPct: number | null;
}

export interface EarnedTrophy {
  key: string;
  worldId: string;
  unlockedAt: Date;
}

/** Best per-game pace across the runs, expressed over 38 games so it reads like a season total. */
function bestPaceOver38(runs: ProfileRun[], value: (r: ProfileRun) => number | null): number {
  let best = 0;
  for (const r of runs) {
    const v = value(r);
    const played = r.won !== null && r.drawn !== null && r.lost !== null ? r.won + r.drawn + r.lost : null;
    if (v !== null && played) best = Math.max(best, (v / played) * 38);
  }
  return Math.floor(best);
}

export function buildCabinet(
  runs: ProfileRun[],
  earned: EarnedTrophy[],
  holders: Map<string, number>,
  totalPlayers: number,
): CabinetEntry[] {
  const finished = runs.filter((r) => r.finished);
  const career = careerProgress(
    finished.map((r) => ({
      createdAt: r.createdAt,
      leagueId: r.leagueId,
      formation: r.formation,
      champion: has(r, "champions"),
    })),
  );
  const progressFor = (key: TrophyKey): CabinetEntry["progress"] => {
    const def = TROPHY_DEFS[key];
    if ((CAREER_TROPHIES as TrophyKey[]).includes(key) && def.target) {
      return { current: Math.min(career[key as CareerTrophyKey], def.target), target: def.target };
    }
    if (key === "centurion") {
      return { current: Math.min(bestPaceOver38(finished, (r) => r.points), 100), target: 100 };
    }
    if (key === "goal-machine") {
      const target = Math.ceil(GOAL_MACHINE_GPG * 38);
      return { current: Math.min(bestPaceOver38(finished, (r) => r.goalsFor), target), target };
    }
    return null;
  };

  return (Object.keys(TROPHY_DEFS) as TrophyKey[]).map((key) => {
    const mine = earned.filter((e) => e.key === key).sort((a, b) => a.unlockedAt.getTime() - b.unlockedAt.getTime());
    const def = TROPHY_DEFS[key];
    return {
      key,
      category: def.category,
      tier: def.tier,
      count: new Set(mine.map((e) => e.worldId)).size,
      firstEarnedAt: mine[0]?.unlockedAt ?? null,
      lastWorldId: mine[mine.length - 1]?.worldId ?? null,
      progress: progressFor(key),
      rarityPct: totalPlayers > 0 ? Math.round(((holders.get(key) ?? 0) / totalPlayers) * 1000) / 10 : null,
    };
  });
}
