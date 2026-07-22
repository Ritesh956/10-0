import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LeaguesService } from "./leagues.service.js";
import { createLeagueSchema, type CreateLeagueDto } from "./leagues.schemas.js";

/** Unguarded — previewing a league's locked rules from a shared invite link shouldn't require
    signing in first (even as a frictionless guest), matching catalog/leaderboard's "openly readable"
    convention. Joining itself still requires auth (below), same as confirming a squad does. */
@Controller("leagues")
export class LeaguesPublicController {
  constructor(@Inject(LeaguesService) private readonly leagues: LeaguesService) {}

  @Get("invite/:code")
  preview(@Param("code") code: string) {
    return this.leagues.getByInviteCode(code);
  }
}

@UseGuards(JwtAuthGuard)
@Controller("leagues")
export class LeaguesController {
  constructor(@Inject(LeaguesService) private readonly leagues: LeaguesService) {}

  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body(new ZodValidationPipe(createLeagueSchema)) dto: CreateLeagueDto) {
    return this.leagues.createLeague(user.sub, dto);
  }

  // Registered before ":leagueId" — a literal "mine" path segment would otherwise be swallowed as a
  // leagueId, the same Nest/Express registration-order gotcha CLAUDE.md already documents for
  // GET /worlds/history vs GET /worlds/:worldId.
  @Get("mine")
  mine(@CurrentUser() user: AuthTokenPayload) {
    return this.leagues.listMine(user.sub);
  }

  @Post("invite/:code/join")
  join(@CurrentUser() user: AuthTokenPayload, @Param("code") code: string) {
    return this.leagues.joinLeague(code, user.sub);
  }

  @Get(":leagueId")
  get(@CurrentUser() user: AuthTokenPayload, @Param("leagueId") leagueId: string) {
    return this.leagues.getLeague(leagueId, user.sub);
  }

  @Get(":leagueId/standings")
  standings(@CurrentUser() user: AuthTokenPayload, @Param("leagueId") leagueId: string) {
    return this.leagues.getStandings(leagueId, user.sub);
  }
}
