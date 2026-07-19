import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Position } from "@futbol/domain";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { buildLineup, type DraftCandidate } from "../common/lineup.js";
import { instantiateWorldClub } from "../common/instantiate-world-club.js";
import type { DraftClubDto, DraftFantasyDto } from "./draft.schemas.js";

@Injectable()
export class DraftService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
  ) {}

  async draftClub(worldId: string, userId: string, dto: DraftClubDto) {
    await this.worlds.assertOwnership(worldId, userId);

    const clubSeason = await this.prisma.refClubSeason.findUnique({
      where: { id: dto.refClubSeasonId },
      include: { club: true, playerSeasons: true },
    });
    if (!clubSeason) throw new NotFoundException("Club season not found");

    const pool: DraftCandidate[] = clubSeason.playerSeasons.map((ps) => ({
      refPlayerSeasonId: ps.id,
      positions: ps.positions as Position[],
      overall: ps.overall,
    }));
    const lineup = buildLineup(dto.formation, pool);

    return instantiateWorldClub(this.prisma, {
      worldId,
      name: clubSeason.club.name,
      refClubSeasonId: clubSeason.id,
      managedByUserId: userId,
      formation: dto.formation,
      lineup,
      allPlayerSeasonIds: clubSeason.playerSeasons.map((p) => p.id),
      refManagerId: dto.refManagerId,
    });
  }

  async draftFantasy(worldId: string, userId: string, dto: DraftFantasyDto) {
    await this.worlds.assertOwnership(worldId, userId);

    const playerSeasons = await this.prisma.refPlayerSeason.findMany({
      where: { id: { in: dto.refPlayerSeasonIds } },
    });
    if (playerSeasons.length !== dto.refPlayerSeasonIds.length) {
      throw new BadRequestException("One or more player seasons were not found");
    }

    const pool: DraftCandidate[] = playerSeasons.map((ps) => ({
      refPlayerSeasonId: ps.id,
      positions: ps.positions as Position[],
      overall: ps.overall,
    }));
    const lineup = buildLineup(dto.formation, pool);

    return instantiateWorldClub(this.prisma, {
      worldId,
      name: dto.name,
      refClubSeasonId: undefined,
      managedByUserId: userId,
      formation: dto.formation,
      lineup,
      allPlayerSeasonIds: dto.refPlayerSeasonIds,
      refManagerId: dto.refManagerId,
    });
  }
}
