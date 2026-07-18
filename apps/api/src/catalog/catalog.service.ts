import { randomInt } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { ClubSeasonFilterDto, PlayerSeasonFilterDto } from "./catalog.schemas.js";

@Injectable()
export class CatalogService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  listEras() {
    return this.prisma.era.findMany({ orderBy: { startYear: "asc" } });
  }

  listLeagues(eraId?: string) {
    return this.prisma.refLeague.findMany({
      ...(eraId ? { where: { eraId } } : {}),
      orderBy: { name: "asc" },
    });
  }

  listClubSeasons(filter: ClubSeasonFilterDto) {
    return this.prisma.refClubSeason.findMany({
      where: {
        league: {
          ...(filter.eraId ? { eraId: filter.eraId } : {}),
          ...(filter.leagueIds?.length ? { id: { in: filter.leagueIds } } : {}),
        },
      },
      include: { club: true, league: true },
      orderBy: { reputation: "desc" },
    });
  }

  listPlayerSeasons(filter: PlayerSeasonFilterDto) {
    return this.prisma.refPlayerSeason.findMany({
      where: {
        ...(filter.clubSeasonId ? { clubSeasonId: filter.clubSeasonId } : {}),
        ...(filter.positions?.length ? { positions: { hasSome: filter.positions } } : {}),
        clubSeason: {
          league: {
            ...(filter.eraId ? { eraId: filter.eraId } : {}),
            ...(filter.leagueIds?.length ? { id: { in: filter.leagueIds } } : {}),
          },
        },
      },
      include: { player: true, clubSeason: { include: { club: true } } },
      orderBy: { overall: "desc" },
    });
  }

  /** A "roll" is a genuine random spin for UX flavor — unrelated to (and never used by) the deterministic match engine's seeded RNG. */
  async rollClubSeason(filter: ClubSeasonFilterDto) {
    const pool = await this.listClubSeasons(filter);
    if (pool.length === 0) throw new NotFoundException("No club seasons match those filters");
    return pool[randomInt(pool.length)];
  }
}
