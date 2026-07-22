import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import type { TrophyKey } from "@futbol/domain";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { SeasonsService } from "../seasons/seasons.service.js";
import { evaluateClubRecordTrophies, resolveTimeWindowCutoff } from "./leaderboard.logic.js";
import type { LeaderboardQueryDto, SubmitLeaderboardDto } from "./leaderboard.schemas.js";

/** Same cast-a-loosely-typed-Json pattern as JanuaryService's WorldSettingsShape. */
interface WorldSettingsShape {
  oneClubClubId?: string;
  nationsNationality?: string;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
    @Inject(SeasonsService) private readonly seasons: SeasonsService,
  ) {}

  /**
   * Submits (or re-submits, upserting in place) a finished run. Only `handle`/`difficulty`/
   * `ratingsMode` come from the client body — everything else (formation, standings, squad
   * overall, league, mode, refClubId) is re-derived here from the world's own persisted state, so
   * the RESULT a leaderboard viewer sees can't be spoofed by a crafted request. One entry per world
   * (`worldId` is `@unique`): re-submitting the same world (e.g. after re-simulating) updates the
   * existing row instead of piling up duplicates.
   */
  async submitRun(worldId: string, seasonId: string, userId: string, dto: SubmitLeaderboardDto) {
    const world = await this.worlds.getWorld(worldId, userId);
    const userClub = world.clubs.find((c) => c.managedByUserId === userId);
    if (!userClub) throw new BadRequestException("You don't manage a club in this world");

    const summary = await this.seasons.getSummary(worldId, seasonId, userId);
    if (!summary.userRow) throw new BadRequestException("No final standing to submit yet — finish the season first");

    // Every AI-filled opponent in a league-accurate season shares one real league (see
    // fillAiClubsFromLeague in seasons.service.ts) — reuse whichever other club still carries its
    // refClubSeasonId to recover that league's name, falling back to the user's own club for the
    // rarer squad-first-draft-of-a-real-club case. Null (e.g. a fantasy-only/multiplayer world with
    // no real-club AI fill at all) just leaves the leaderboard's League filter as "Mixed".
    const leagueSourceClub =
      world.clubs.find((c) => c.id !== userClub.id && c.refClubSeasonId) ??
      (userClub.refClubSeasonId ? userClub : undefined);
    const leagueName =
      (leagueSourceClub?.refClubSeasonId
        ? (
            await this.prisma.refClubSeason.findUnique({
              where: { id: leagueSourceClub.refClubSeasonId },
              include: { league: true },
            })
          )?.league.name
        : undefined) ?? null;

    // mode/refClubId/nationality come from World.settings, set once at world-creation time by the
    // frontend's ClubsDirectoryPage/NationsDirectoryPage flows — never from this request's own
    // body, so a one-club or nations run can't be faked (or disguised as "solo") by a crafted
    // submission. oneClubClubId and nationsNationality are never both set (mutually exclusive
    // locked-draft variants), so refClubId takes precedence only because it's checked first.
    const settings = (world.settings as WorldSettingsShape | null) ?? {};
    const refClubId = settings.oneClubClubId ?? null;
    const nationality = settings.nationsNationality ?? null;
    const mode = refClubId ? "one-club" : nationality ? "nations" : "solo";

    const { userRow } = summary;
    const shared = {
      handle: dto.handle,
      difficulty: dto.difficulty,
      ratingsMode: dto.ratingsMode,
      formation: userClub.formation ?? "—",
      squadOverall: summary.squadOverall ?? 0,
      clubName: userClub.name,
      leagueName,
      mode,
      refClubId,
      nationality,
      won: userRow.won,
      drawn: userRow.drawn,
      lost: userRow.lost,
      goalDiff: userRow.goalsFor - userRow.goalsAgainst,
      points: userRow.points,
    };
    const entry = await this.prisma.leaderboardEntry.upsert({
      where: { worldId },
      create: { worldId, userId, ...shared },
      update: shared,
    });

    const newTrophies = refClubId
      ? await this.evaluateAndPersistClubTrophies(worldId, entry.id, userId, refClubId, userRow.points)
      : [];

    return { entry, newTrophies };
  }

  /**
   * One-Club XI (Phase 7): compares this run's points against every *other* LeaderboardEntry ever
   * submitted for the same real club (mode="one-club", excluding this entry's own row — relevant on
   * a re-submission after re-simulating) and persists any newly-earned club-record trophies as
   * Achievement rows against this run's own worldId, same idempotent createMany+skipDuplicates
   * pattern as SeasonsService.finalizeRun (whose Achievement rows for this same worldId these sit
   * alongside — TrophyCabinet/HistoryPage already render whatever's under a world's key).
   */
  private async evaluateAndPersistClubTrophies(
    worldId: string,
    entryId: string,
    userId: string,
    refClubId: string,
    newPoints: number,
  ): Promise<TrophyKey[]> {
    const priorEntries = await this.prisma.leaderboardEntry.findMany({
      where: { mode: "one-club", refClubId, id: { not: entryId } },
      select: { points: true },
    });
    const trophies = evaluateClubRecordTrophies(
      newPoints,
      priorEntries.map((e) => e.points),
    );
    if (trophies.length > 0) {
      await this.prisma.achievement.createMany({
        data: trophies.map((key) => ({ worldId, userId, key })),
        skipDuplicates: true,
      });
    }
    return trophies;
  }

  /** Public, filtered, ranked-by-points listing — no ownership check, matches the catalog module's
      unguarded convention (a leaderboard is meant to be openly browsable). */
  async list(query: LeaderboardQueryDto) {
    const cutoff = resolveTimeWindowCutoff(query.timeWindow, new Date());
    return this.prisma.leaderboardEntry.findMany({
      where: {
        ...(query.mode ? { mode: query.mode } : {}),
        ...(query.difficulty ? { difficulty: query.difficulty } : {}),
        ...(query.ratingsMode ? { ratingsMode: query.ratingsMode } : {}),
        ...(query.formation ? { formation: query.formation } : {}),
        ...(query.leagueName ? { leagueName: query.leagueName } : {}),
        ...(query.refClubId ? { refClubId: query.refClubId } : {}),
        ...(query.nationality ? { nationality: query.nationality } : {}),
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      },
      orderBy: [{ points: "desc" }, { goalDiff: "desc" }],
      take: query.limit,
    });
  }

  /** Lightweight moderation entry point ("⚐ Report a name") — increments a counter rather than
      hiding/deleting the row outright; a human still reviews reported handles. Unguarded, same as
      `list`, since reporting shouldn't require the reporter to own the run. */
  async report(entryId: string) {
    const existing = await this.prisma.leaderboardEntry.findUnique({ where: { id: entryId } });
    if (!existing) throw new NotFoundException("Leaderboard entry not found");
    return this.prisma.leaderboardEntry.update({
      where: { id: entryId },
      data: { reportCount: { increment: 1 } },
    });
  }
}
