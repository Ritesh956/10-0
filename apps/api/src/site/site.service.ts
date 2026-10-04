import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";

export interface SiteStats {
  seasonsSimulated: number;
  xisDrafted: number;
  matchesPlayed: number;
  invincibles: number;
  topRuns: { handle: string; points: number; won: number; drawn: number; lost: number; leagueName: string | null }[];
}

const CACHE_MS = 60_000;

@Injectable()
export class SiteService {
  private cache: { at: number; value: Promise<SiteStats> } | null = null;

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Public counters for the landing page's social proof. Cached for a minute (and shared by
      concurrent callers) so a busy landing page doesn't turn into a stream of COUNT queries. */
  getStats(now = Date.now()): Promise<SiteStats> {
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.value;
    const value = this.load();
    this.cache = { at: now, value };
    value.catch(() => {
      this.cache = null; // don't keep serving a failed load
    });
    return value;
  }

  private async load(): Promise<SiteStats> {
    const [seasonsSimulated, xisDrafted, matchesPlayed, invincibles, topRuns] = await Promise.all([
      this.prisma.season.count({ where: { status: "COMPLETED", competition: { type: "LEAGUE" } } }),
      this.prisma.worldClub.count({ where: { managedByUserId: { not: null } } }),
      this.prisma.match.count(),
      this.prisma.achievement.count({ where: { key: "invincible" } }),
      this.prisma.leaderboardEntry.findMany({
        where: { mode: "solo" },
        orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
        take: 3,
        select: { handle: true, points: true, won: true, drawn: true, lost: true, leagueName: true },
      }),
    ]);
    return { seasonsSimulated, xisDrafted, matchesPlayed, invincibles, topRuns };
  }
}
