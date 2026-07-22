import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LeaderboardService } from "./leaderboard.service.js";
import { leaderboardQuerySchema, submitLeaderboardSchema, type SubmitLeaderboardDto } from "./leaderboard.schemas.js";

// Submission is world-scoped and ownership-checked, so it sits behind auth like every other
// worlds/* route. Listing and reporting are deliberately unguarded on a separate top-level
// controller below — a leaderboard is meant to be openly browsable, same as the catalog module.
@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/seasons/:seasonId/leaderboard")
export class LeaderboardSubmitController {
  constructor(@Inject(LeaderboardService) private readonly leaderboard: LeaderboardService) {}

  @Post()
  submit(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("seasonId") seasonId: string,
    @Body(new ZodValidationPipe(submitLeaderboardSchema)) dto: SubmitLeaderboardDto,
  ) {
    return this.leaderboard.submitRun(worldId, seasonId, user.sub, dto);
  }
}

@Controller("leaderboard")
export class LeaderboardController {
  constructor(@Inject(LeaderboardService) private readonly leaderboard: LeaderboardService) {}

  @Get()
  list(@Query(new ZodValidationPipe(leaderboardQuerySchema)) query: ReturnType<typeof leaderboardQuerySchema.parse>) {
    return this.leaderboard.list(query);
  }

  @Post(":entryId/report")
  report(@Param("entryId") entryId: string) {
    return this.leaderboard.report(entryId);
  }
}
