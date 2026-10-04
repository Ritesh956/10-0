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

  /**
   * The world as the web app reads it: each club also carries the country of the league it plays in,
   * so tables can show a flag — which matters once European Nights puts clubs from all five leagues
   * in one world. The user's own club plays in the chosen league whatever its drafted squad's origin.
   */
  async getWorldView(worldId: string, userId: string) {
    const world = await this.getWorld(worldId, userId);
    const seasonIds = world.clubs.map((c) => c.refClubSeasonId).filter((id): id is string => id !== null);
    const leagueId = (world.settings as { leagueId?: string } | null)?.leagueId;
    const [rows, home] = await Promise.all([
      seasonIds.length
        ? this.prisma.refClubSeason.findMany({ where: { id: { in: seasonIds } }, select: { id: true, league: { select: { country: true } } } })
        : Promise.resolve([]),
      leagueId ? this.prisma.refLeague.findUnique({ where: { id: leagueId }, select: { country: true } }) : Promise.resolve(null),
    ]);
    const countryBySeason = new Map(rows.map((r) => [r.id, r.league.country]));
    return {
      ...world,
      clubs: world.clubs.map((c) => ({
        ...c,
        country: (c.managedByUserId ? home?.country : undefined) ?? (c.refClubSeasonId ? countryBySeason.get(c.refClubSeasonId) : undefined) ?? home?.country ?? null,
      })),
    };
  }

  /** Throws if the world doesn't exist or isn't owned by userId; used by other modules that operate within a world. */
  async assertOwnership(worldId: string, userId: string): Promise<void> {
    await this.getWorld(worldId, userId);
  }
}
