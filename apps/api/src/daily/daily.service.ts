import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import {
  MAX_DAILY_ATTEMPTS,
  computePoolStats,
  computeScore,
  generateChallenge,
  type DailyCandidate,
  type DailyConstraint,
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
export class DailyService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

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
    if (existing) return this.toChallengeDto(existing);

    const pool = await this.loadPool();
    const generated = generateChallenge(dateKey, pool);
    const poolStats = computePoolStats(pool, generated.anchor, generated.constraints);
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
      poolStats: challenge.poolStats as { totalPlayers: number; eligiblePerConstraint: number[] },
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
