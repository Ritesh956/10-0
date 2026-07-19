import { Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { EuropeService } from "./europe.service.js";

@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/europe")
export class EuropeController {
  constructor(@Inject(EuropeService) private readonly europe: EuropeService) {}

  @Get("status")
  status(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Query("domesticSeasonId") domesticSeasonId: string,
  ) {
    return this.europe.getStatus(worldId, domesticSeasonId, user.sub);
  }

  @Post("league-phase")
  leaguePhase(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Query("domesticSeasonId") domesticSeasonId: string,
  ) {
    return this.europe.startLeaguePhase(worldId, domesticSeasonId, user.sub);
  }

  @Post(":competitionId/knockouts")
  knockouts(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("competitionId") competitionId: string,
    @Query("leaguePhaseSeasonId") leaguePhaseSeasonId: string,
  ) {
    return this.europe.startKnockouts(worldId, competitionId, leaguePhaseSeasonId, user.sub);
  }

  @Post(":competitionId/advance")
  advance(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("competitionId") competitionId: string,
    @Query("round") round: "QF" | "SF" | "FINAL",
  ) {
    return this.europe.advanceKnockouts(worldId, competitionId, round, user.sub);
  }

  @Get(":competitionId/bracket")
  bracket(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("competitionId") competitionId: string,
  ) {
    return this.europe.getBracket(worldId, competitionId, user.sub);
  }

  @Get("league-phase-standings")
  leaguePhaseStandings(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Query("seasonId") seasonId: string,
  ) {
    return this.europe.getLeaguePhaseStandings(worldId, seasonId, user.sub);
  }
}
