import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SeasonsService } from "./seasons.service.js";
import { createSeasonSchema, type CreateSeasonDto } from "./seasons.schemas.js";

@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/seasons")
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Body(new ZodValidationPipe(createSeasonSchema)) dto: CreateSeasonDto,
  ) {
    return this.seasons.createSeason(worldId, user.sub, dto);
  }

  @Get(":seasonId")
  get(@CurrentUser() user: AuthTokenPayload, @Param("worldId") worldId: string, @Param("seasonId") seasonId: string) {
    return this.seasons.getSeason(worldId, seasonId, user.sub);
  }

  @Post(":seasonId/simulate")
  simulate(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("seasonId") seasonId: string,
  ) {
    return this.seasons.requestSimulation(worldId, seasonId, user.sub);
  }

  @Get(":seasonId/standings")
  standings(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("seasonId") seasonId: string,
  ) {
    return this.seasons.getStandings(worldId, seasonId, user.sub);
  }

  @Get(":seasonId/summary")
  summary(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("seasonId") seasonId: string,
  ) {
    return this.seasons.getSummary(worldId, seasonId, user.sub);
  }
}
