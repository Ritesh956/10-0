import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { CreateWorldDto } from "./worlds.schemas.js";

@Injectable()
export class WorldsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  createWorld(userId: string, dto: CreateWorldDto) {
    return this.prisma.world.create({
      data: { ownerId: userId, eraId: dto.eraId, type: dto.type },
      include: { clubs: true },
    });
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
}
