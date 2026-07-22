import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { CreateWorldDto } from "./worlds.schemas.js";

@Injectable()
export class WorldsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async createWorld(userId: string, dto: CreateWorldDto) {
    const world = await this.prisma.world.create({
      data: { ownerId: userId, eraId: dto.eraId, type: dto.type, settings: dto.settings },
      include: { clubs: true },
    });

    // Phase 9a: attach this world to the caller's league membership, joining implicitly if they
    // somehow reached draft-confirm without an explicit join call — see worlds.schemas.ts's comment.
    const leagueId = dto.settings.multiplayerLeagueId;
    if (leagueId) {
      await this.prisma.leagueMembership.upsert({
        where: { leagueId_userId: { leagueId, userId } },
        create: { leagueId, userId, worldId: world.id },
        update: { worldId: world.id },
      });
    }

    return world;
  }

  listWorlds(userId: string) {
    return this.prisma.world.findMany({
      where: { ownerId: userId },
      include: { clubs: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getWorld(worldId: string, userId: string) {
    const world = await this.prisma.world.findUnique({
      where: { id: worldId },
      include: { clubs: true, era: true },
    });
    if (!world || world.ownerId !== userId) throw new NotFoundException("World not found");
    return world;
  }

  /** Throws if the world doesn't exist or isn't owned by userId; used by other modules that operate within a world. */
  async assertOwnership(worldId: string, userId: string): Promise<void> {
    await this.getWorld(worldId, userId);
  }

  /**
   * Per-world summary for the "Your history" page: club name/formation (already on WorldClub, no
   * extra query), a headline points total (from the WorldRecord SeasonsService.finalizeRun
   * persists), and unlocked trophies (from Achievement). Worlds whose run was never finalized
   * (still in progress, or the user never reached the stats hub) simply show no points/trophies —
   * still listed, just without a "result" yet.
   */
  async getHistory(userId: string) {
    const worlds = await this.prisma.world.findMany({
      where: { ownerId: userId },
      include: { clubs: true },
      orderBy: { createdAt: "desc" },
    });
    const worldIds = worlds.map((w) => w.id);
    if (worldIds.length === 0) return [];

    const [achievements, records] = await Promise.all([
      this.prisma.achievement.findMany({ where: { worldId: { in: worldIds }, userId } }),
      this.prisma.worldRecord.findMany({ where: { worldId: { in: worldIds }, name: "points-total" } }),
    ]);
    const trophiesByWorld = new Map<string, string[]>();
    for (const a of achievements) {
      const list = trophiesByWorld.get(a.worldId) ?? [];
      list.push(a.key);
      trophiesByWorld.set(a.worldId, list);
    }
    const pointsByWorld = new Map(records.map((r) => [r.worldId, r.value]));

    return worlds.map((w) => {
      const userClub = w.clubs.find((c) => c.managedByUserId === userId);
      return {
        worldId: w.id,
        createdAt: w.createdAt,
        status: w.status,
        clubName: userClub?.name ?? null,
        formation: userClub?.formation ?? null,
        pointsTotal: pointsByWorld.get(w.id) ?? null,
        trophies: trophiesByWorld.get(w.id) ?? [],
      };
    });
  }
}
