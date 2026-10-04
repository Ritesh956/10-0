import { Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { NationsCupService } from "./nations-cup.service.js";

@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/nations-cup")
export class NationsCupController {
  constructor(@Inject(NationsCupService) private readonly nationsCup: NationsCupService) {}

  @Get()
  status(@CurrentUser() user: AuthTokenPayload, @Param("worldId") worldId: string) {
    return this.nationsCup.getStatus(worldId, user.sub);
  }

  @Post()
  start(@CurrentUser() user: AuthTokenPayload, @Param("worldId") worldId: string) {
    return this.nationsCup.start(worldId, user.sub);
  }

  @Get("groups")
  groups(@CurrentUser() user: AuthTokenPayload, @Param("worldId") worldId: string, @Query("seasonId") seasonId: string) {
    return this.nationsCup.getGroups(worldId, seasonId, user.sub);
  }

  @Post(":competitionId/knockouts")
  knockouts(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("competitionId") competitionId: string,
  ) {
    return this.nationsCup.startKnockouts(worldId, competitionId, user.sub);
  }
}
