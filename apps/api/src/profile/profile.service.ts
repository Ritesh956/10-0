import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import {
  buildCabinet,
  computeCareerStats,
  computeStreaks,
  type ProfileRun,
  type RunMode,
} from "./profile.logic.js";

const RUN_RECORDS = [
  "points-total",
  "final-position",
  "league-size",
  "won",
  "drawn",
  "lost",
  "goals-for",
  "goals-against",
  "squad-overall",
  "longest-win-streak",
];

interface SettingsShape {
  leagueId?: string;
  oneClubClubId?: string;
  nationsNationality?: string;
  multiplayerLeagueId?: string;
}

function runMode(settings: SettingsShape): RunMode {
  if (settings.oneClubClubId) return "one-club";
  if (settings.nationsNationality) return "nations";
  if (settings.multiplayerLeagueId) return "league";
  return "solo";
}

@Injectable()
export class ProfileService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Career stats, streaks, the full trophy cabinet (earned and locked, with progress and how rare
      each one is across all players) and every run — all derived from what finalizeRun recorded. */
  async getProfile(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    const worlds = await this.prisma.world.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        createdAt: true,
        settings: true,
        clubs: { where: { managedByUserId: userId }, select: { name: true, formation: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const worldIds = worlds.map((w) => w.id);

    const [records, achievements, holderRows, playerRows, dailyEntries] = await Promise.all([
      this.prisma.worldRecord.findMany({ where: { worldId: { in: worldIds }, name: { in: RUN_RECORDS } } }),
      this.prisma.achievement.findMany({ where: { userId, worldId: { in: worldIds } } }),
      this.prisma.$queryRaw<{ key: string; holders: number }[]>`
        SELECT key, COUNT(DISTINCT "userId")::int AS holders FROM achievements GROUP BY key`,
      this.prisma.$queryRaw<{ players: number }[]>`
        SELECT COUNT(DISTINCT w."ownerId")::int AS players
        FROM records r JOIN worlds w ON w.id = r."worldId" WHERE r.name = 'points-total'`,
      this.prisma.dailyChallengeEntry.findMany({ where: { userId }, select: { score: true, maxScore: true } }),
    ]);

    const recordsByWorld = new Map<string, Map<string, number>>();
    for (const r of records) {
      const m = recordsByWorld.get(r.worldId) ?? new Map<string, number>();
      m.set(r.name, r.value);
      recordsByWorld.set(r.worldId, m);
    }
    const trophiesByWorld = new Map<string, string[]>();
    for (const a of achievements) {
      const list = trophiesByWorld.get(a.worldId) ?? [];
      list.push(a.key);
      trophiesByWorld.set(a.worldId, list);
    }

    const runs: ProfileRun[] = worlds.map((w) => {
      const rec = recordsByWorld.get(w.id) ?? new Map<string, number>();
      const get = (name: string) => rec.get(name) ?? null;
      const settings = (w.settings ?? {}) as SettingsShape;
      const club = w.clubs[0];
      return {
        worldId: w.id,
        createdAt: w.createdAt,
        clubName: club?.name ?? null,
        formation: club?.formation ?? null,
        leagueId: settings.leagueId ?? null,
        mode: runMode(settings),
        finished: rec.has("points-total"),
        points: get("points-total"),
        position: get("final-position"),
        leagueSize: get("league-size"),
        won: get("won"),
        drawn: get("drawn"),
        lost: get("lost"),
        goalsFor: get("goals-for"),
        goalsAgainst: get("goals-against"),
        squadOverall: get("squad-overall"),
        longestWinStreak: get("longest-win-streak"),
        trophies: trophiesByWorld.get(w.id) ?? [],
      };
    });

    const holders = new Map(holderRows.map((r) => [r.key, r.holders]));
    const totalPlayers = playerRows[0]?.players ?? 0;

    return {
      user: { displayName: user.displayName, isGuest: user.isGuest, memberSince: user.createdAt },
      stats: computeCareerStats(runs, new Set(achievements.map((a) => a.key)).size),
      streaks: computeStreaks(runs, now),
      cabinet: buildCabinet(runs, achievements, holders, totalPlayers),
      daily: {
        played: dailyEntries.length,
        perfect: dailyEntries.filter((e) => e.maxScore > 0 && e.score >= e.maxScore).length,
        bestScore: dailyEntries.reduce((best, e) => Math.max(best, e.score), 0),
      },
      runs,
    };
  }
}
