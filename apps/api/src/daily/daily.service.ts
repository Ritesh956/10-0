import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import {
  MAX_DAILY_ATTEMPTS,
  computePoolStats,
  computeScore,
  generateChallenge,
  summarizeRecap,
  type DailyCandidate,
  type DailyConstraint,
  type PoolStats,
} from "./daily.logic.js";
import type { SubmitDailyAttemptDto } from "./daily.schemas.js";

/** Mirrors catalog.service.ts's own copy (see CLAUDE.md's note on this convention) — the daily pool
    draws from the same real top-5 catalog the draft flow does, all eras (a richer, cross-era spread
    is exactly what makes the puzzle interesting day to day). */
const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function toBirthMonthDay(dateOfBirth: Date): string {
  return dateOfBirth.toISOString().slice(5, 10);
}

@Injectable()
export class DailyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyService.name);
  /** One shared generation per date, so concurrent first requests don't each load the full pool. */
  private readonly generating = new Map<string, ReturnType<DailyService["generateFor"]>>();
  private warmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Generating a day's puzzle loads the whole catalog (~30s against the hosted DB), which used to
      land on whichever player opened /daily first that day. Generate it at boot and again just
      after each UTC midnight instead, so player requests only ever read the stored row. */
  onModuleInit(): void {
    void this.warmToday();
    this.scheduleNextWarm();
  }

  onModuleDestroy(): void {
    if (this.warmTimer) clearTimeout(this.warmTimer);
  }

  private scheduleNextWarm(): void {
    const now = new Date();
    const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    this.warmTimer = setTimeout(() => {
      void this.warmToday();
      this.scheduleNextWarm();
    }, nextMidnight - now.getTime() + 5_000);
    this.warmTimer.unref?.();
  }

  private async warmToday(): Promise<void> {
    try {
      await this.getTodayChallenge();
    } catch (err) {
      // Not fatal — the first player request will generate it instead.
      this.logger.warn(`Daily challenge pre-generation failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Deterministic-per-date puzzle (Phase 8): the first `/daily/today` request of a calendar date
   * (UTC) generates and persists the challenge; every later request for that same date — from any
   * user — just reads the same row back, which is what makes "everyone sees the same puzzle" true
   * without a cron job. Generation itself is a pure function of the date + the current catalog
   * (daily.logic.ts's generateChallenge), so even a rare double-generation race is harmless: both
   * requests would compute identical values, and `upsert` on the unique `date` just keeps whichever
   * wrote first.
   */
  async getTodayChallenge() {
    const dateKey = todayDateKey();
    const dateValue = new Date(`${dateKey}T00:00:00.000Z`);
    const existing = await this.prisma.dailyChallenge.findUnique({ where: { date: dateValue } });
    if (existing) return this.toChallengeDto(await this.withBoostPools(existing));

    let inflight = this.generating.get(dateKey);
    if (!inflight) {
      inflight = this.generateFor(dateKey, dateValue).finally(() => this.generating.delete(dateKey));
      this.generating.set(dateKey, inflight);
    }
    return inflight;
  }

  private async generateFor(dateKey: string, dateValue: Date) {
    const pool = await this.loadPool();
    const generated = generateChallenge(dateKey, pool);
    const poolStats: PoolStats = {
      ...computePoolStats(pool, generated.anchor, generated.constraints),
      clubSeasonIdsPerConstraint: await this.clubSeasonPools(generated.constraints),
    };
    const refreshesAt = new Date(dateValue.getTime() + 24 * 60 * 60 * 1000);

    const created = await this.prisma.dailyChallenge.upsert({
      where: { date: dateValue },
      create: {
        date: dateValue,
        theme: generated.theme,
        themeLabel: generated.themeLabel,
        anchorPlayerSeasonId: generated.anchor.id,
        fixedFormation: generated.fixedFormation,
        constraints: generated.constraints as unknown as object,
        poolStats: poolStats as unknown as object,
        refreshesAt,
      },
      update: {},
    });

    return this.toChallengeDto(created, generated.anchor);
  }

  /** For each constraint, the real club-seasons with at least one player who satisfies it — see
      PoolStats.clubSeasonIdsPerConstraint. */
  private async clubSeasonPools(constraints: DailyConstraint[]): Promise<string[][]> {
    const realLeague = { league: { country: { in: REAL_LEAGUE_COUNTRIES } } };
    return Promise.all(
      constraints.map(async (c) => {
        const rows = await this.prisma.refClubSeason.findMany({
          where:
            c.type === "club"
              ? { ...realLeague, clubId: c.value }
              : { ...realLeague, playerSeasons: { some: { player: { nationality: c.value } } } },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }),
    );
  }

  /** Challenges generated before the boost pools existed get them computed and stored on first read. */
  private async withBoostPools<T extends { id: string; constraints: unknown; poolStats: unknown }>(challenge: T): Promise<T> {
    const stats = challenge.poolStats as PoolStats;
    if (stats.clubSeasonIdsPerConstraint) return challenge;
    const poolStats: PoolStats = {
      ...stats,
      clubSeasonIdsPerConstraint: await this.clubSeasonPools(challenge.constraints as DailyConstraint[]),
    };
    await this.prisma.dailyChallenge.update({ where: { id: challenge.id }, data: { poolStats: poolStats as unknown as object } });
    return { ...challenge, poolStats };
  }

  /** Yesterday's (UTC) puzzle with its community result, or null if there wasn't one. */
  async getYesterdayRecap() {
    const today = new Date(`${todayDateKey()}T00:00:00.000Z`);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const challenge = await this.prisma.dailyChallenge.findUnique({
      where: { date: yesterday },
      include: { entries: { select: { score: true, maxScore: true, attemptsUsed: true } } },
    });
    if (!challenge) return null;
    const constraints = challenge.constraints as unknown as DailyConstraint[];
    return summarizeRecap(
      {
        date: challenge.date.toISOString().slice(0, 10),
        themeLabel: challenge.themeLabel,
        maxScore: constraints.reduce((sum, c) => sum + c.required * 10, 0),
      },
      challenge.entries,
    );
  }

  /** Past dailies, newest first, with each one's community numbers — the archive list. Old puzzles
      stay playable (same five attempts) through getChallengeByDate. */
  async getArchive(limit = 120) {
    const today = new Date(`${todayDateKey()}T00:00:00.000Z`);
    const challenges = await this.prisma.dailyChallenge.findMany({
      where: { date: { lt: today } },
      orderBy: { date: "desc" },
      take: limit,
      select: { id: true, date: true, theme: true, themeLabel: true, fixedFormation: true, anchorPlayerSeasonId: true, constraints: true },
    });
    const ids = challenges.map((c) => c.id);
    const [stats, anchors] = await Promise.all([
      ids.length
        ? this.prisma.dailyChallengeEntry.groupBy({
            by: ["dailyChallengeId"],
            where: { dailyChallengeId: { in: ids } },
            _count: { _all: true },
            _max: { score: true },
          })
        : Promise.resolve([]),
      this.prisma.refPlayerSeason.findMany({
        where: { id: { in: challenges.map((c) => c.anchorPlayerSeasonId) } },
        select: { id: true, player: { select: { name: true } } },
      }),
    ]);
    const statsById = new Map(stats.map((s) => [s.dailyChallengeId, s]));
    const anchorName = new Map(anchors.map((a) => [a.id, a.player.name]));
    return challenges.map((c) => ({
      id: c.id,
      date: c.date.toISOString().slice(0, 10),
      theme: c.theme,
      themeLabel: c.themeLabel,
      fixedFormation: c.fixedFormation,
      anchorName: anchorName.get(c.anchorPlayerSeasonId) ?? null,
      maxScore: (c.constraints as unknown as DailyConstraint[]).reduce((sum, k) => sum + k.required * 10, 0),
      players: statsById.get(c.id)?._count._all ?? 0,
      topScore: statsById.get(c.id)?._max.score ?? null,
    }));
  }

  /** The signed-in player's result on every daily they've played, keyed by challenge id. */
  async getMyArchive(userId: string) {
    const entries = await this.prisma.dailyChallengeEntry.findMany({
      where: { userId },
      select: { dailyChallengeId: true, score: true, maxScore: true, attemptsUsed: true },
    });
    return Object.fromEntries(
      entries.map((e) => [e.dailyChallengeId, { score: e.score, maxScore: e.maxScore, attemptsUsed: e.attemptsUsed }]),
    );
  }

  /** One day's puzzle by date ("YYYY-MM-DD"), for the archive. Today's is generated on demand like
      /daily/today; a past day only exists if it was generated at the time, and future days don't. */
  async getChallengeByDate(dateKey: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number.isNaN(Date.parse(`${dateKey}T00:00:00.000Z`))) {
      throw new BadRequestException("Date must be YYYY-MM-DD");
    }
    const today = todayDateKey();
    if (dateKey > today) throw new NotFoundException("That daily hasn't happened yet");
    if (dateKey === today) return this.getTodayChallenge();
    const challenge = await this.prisma.dailyChallenge.findUnique({ where: { date: new Date(`${dateKey}T00:00:00.000Z`) } });
    if (!challenge) throw new NotFoundException("No daily challenge on that date");
    return this.toChallengeDto(await this.withBoostPools(challenge));
  }

  /** The signed-in player's own standing on a challenge — attempts used and best score so far. */
  async getMyEntry(challengeId: string, userId: string) {
    const entry = await this.prisma.dailyChallengeEntry.findUnique({
      where: { dailyChallengeId_userId: { dailyChallengeId: challengeId, userId } },
    });
    return {
      attemptsUsed: entry?.attemptsUsed ?? 0,
      attemptsRemaining: Math.max(MAX_DAILY_ATTEMPTS - (entry?.attemptsUsed ?? 0), 0),
      bestScore: entry?.score ?? null,
      maxScore: entry?.maxScore ?? null,
    };
  }

  /** Loads the whole draftable top-5 catalog, deduped to one canonical (highest-overall) row per
      real person — generation and scoring both reason about people, not individual seasons. */
  private async loadPool(): Promise<DailyCandidate[]> {
    const rows = await this.prisma.refPlayerSeason.findMany({
      where: { clubSeason: { league: { country: { in: REAL_LEAGUE_COUNTRIES } } } },
      include: { player: true, clubSeason: { include: { club: true } } },
      orderBy: { overall: "desc" },
    });

    const seen = new Set<string>();
    const pool: DailyCandidate[] = [];
    for (const row of rows) {
      if (seen.has(row.playerId)) continue;
      seen.add(row.playerId);
      pool.push({
        id: row.id,
        playerId: row.playerId,
        name: row.player.name,
        nationality: row.player.nationality,
        birthMonthDay: toBirthMonthDay(row.player.dateOfBirth),
        overall: row.overall,
        clubId: row.clubSeason.club.id,
        clubName: row.clubSeason.club.name,
        positions: row.positions,
        photoUrl: row.player.photoUrl,
      });
    }
    return pool;
  }

  /** Re-fetches the one anchor row for a challenge generated on a previous request — the pool
      itself is only ever loaded once, at generation time. */
  private async loadAnchor(refPlayerSeasonId: string): Promise<DailyCandidate> {
    const row = await this.prisma.refPlayerSeason.findUniqueOrThrow({
      where: { id: refPlayerSeasonId },
      include: { player: true, clubSeason: { include: { club: true } } },
    });
    return {
      id: row.id,
      playerId: row.playerId,
      name: row.player.name,
      nationality: row.player.nationality,
      birthMonthDay: toBirthMonthDay(row.player.dateOfBirth),
      overall: row.overall,
      clubId: row.clubSeason.club.id,
      clubName: row.clubSeason.club.name,
      positions: row.positions,
      photoUrl: row.player.photoUrl,
    };
  }

  private async toChallengeDto(
    challenge: {
      id: string;
      date: Date;
      theme: string;
      themeLabel: string;
      anchorPlayerSeasonId: string;
      fixedFormation: string;
      constraints: unknown;
      poolStats: unknown;
      refreshesAt: Date;
    },
    knownAnchor?: DailyCandidate,
  ) {
    const anchor = knownAnchor ?? (await this.loadAnchor(challenge.anchorPlayerSeasonId));

    return {
      id: challenge.id,
      date: challenge.date.toISOString().slice(0, 10),
      theme: challenge.theme,
      themeLabel: challenge.themeLabel,
      fixedFormation: challenge.fixedFormation,
      refreshesAt: challenge.refreshesAt.toISOString(),
      anchor: {
        id: anchor.id,
        playerId: anchor.playerId,
        name: anchor.name,
        nationality: anchor.nationality,
        overall: anchor.overall,
        positions: anchor.positions,
        photoUrl: anchor.photoUrl,
        clubName: anchor.clubName,
        clubId: anchor.clubId,
      },
      constraints: challenge.constraints as DailyConstraint[],
      poolStats: challenge.poolStats as PoolStats,
    };
  }

  /**
   * Scores a submitted attempt and upserts the user's best-of-the-day entry. `dto.picks` is the full
   * 11-player squad including the anchor's own id exactly once — the anchor is stripped back out
   * before scoring, since every constraint's `required` count already means "beyond the anchor".
   * Rejects a 6th attempt for the same challenge+user (MAX_DAILY_ATTEMPTS).
   */
  async submitAttempt(challengeId: string, userId: string, dto: SubmitDailyAttemptDto) {
    const challenge = await this.prisma.dailyChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException("Daily challenge not found");

    const uniqueIds = new Set(dto.picks);
    if (uniqueIds.size !== dto.picks.length) {
      throw new BadRequestException("Squad contains a duplicate pick");
    }
    if (!uniqueIds.has(challenge.anchorPlayerSeasonId)) {
      throw new BadRequestException("Squad must include the pre-seeded anchor player");
    }

    const seasons = await this.prisma.refPlayerSeason.findMany({
      where: { id: { in: dto.picks } },
      include: { player: true, clubSeason: { include: { club: true } } },
    });
    if (seasons.length !== dto.picks.length) {
      throw new BadRequestException("One or more picks are not valid players");
    }

    const playerIds = new Set(seasons.map((s) => s.playerId));
    if (playerIds.size !== seasons.length) {
      throw new BadRequestException("The same real player can't appear twice in your squad");
    }

    const constraints = challenge.constraints as unknown as DailyConstraint[];
    const scoredPicks = seasons
      .filter((s) => s.id !== challenge.anchorPlayerSeasonId)
      .map((s) => ({ playerId: s.playerId, nationality: s.player.nationality, clubId: s.clubSeason.club.id }));
    const { score, maxScore, results } = computeScore(scoredPicks, constraints);

    const overalls = seasons.map((s) => s.overall);
    const squadOverall = Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length);

    const existing = await this.prisma.dailyChallengeEntry.findUnique({
      where: { dailyChallengeId_userId: { dailyChallengeId: challengeId, userId } },
    });
    if (existing && existing.attemptsUsed >= MAX_DAILY_ATTEMPTS) {
      throw new BadRequestException("No attempts remaining today — come back tomorrow for a new puzzle");
    }

    const isNewBest = !existing || score > existing.score;
    const attemptsUsed = (existing?.attemptsUsed ?? 0) + 1;
    const entry = await this.prisma.dailyChallengeEntry.upsert({
      where: { dailyChallengeId_userId: { dailyChallengeId: challengeId, userId } },
      create: { dailyChallengeId: challengeId, userId, handle: dto.handle, squadOverall, score, maxScore, attemptsUsed },
      update: isNewBest
        ? { handle: dto.handle, squadOverall, score, maxScore, attemptsUsed }
        : { attemptsUsed },
    });

    return {
      score,
      maxScore,
      results,
      attemptsUsed,
      attemptsRemaining: Math.max(MAX_DAILY_ATTEMPTS - attemptsUsed, 0),
      isNewBest,
      entry,
    };
  }

  async listLeaderboard(challengeId: string, limit: number) {
    return this.prisma.dailyChallengeEntry.findMany({
      where: { dailyChallengeId: challengeId },
      orderBy: [{ score: "desc" }, { squadOverall: "desc" }],
      take: limit,
    });
  }
}
