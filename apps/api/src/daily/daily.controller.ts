import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { DailyService } from "./daily.service.js";
import { dailyLeaderboardQuerySchema, submitDailyAttemptSchema, type SubmitDailyAttemptDto } from "./daily.schemas.js";

// Reading today's puzzle and its leaderboard is unguarded, same convention as catalog/leaderboard —
// only submitting an attempt (which persists a scored, user-owned entry) requires auth.
@Controller("daily")
export class DailyController {
  constructor(@Inject(DailyService) private readonly daily: DailyService) {}

  @Get("today")
  getToday() {
    return this.daily.getTodayChallenge();
  }

  // Registered before the ":challengeId/..." routes for readability; the literal segment can't
  // collide with them anyway since those all have a second path segment.
  @Get("yesterday")
  async yesterday() {
    // Wrapped so "no puzzle yesterday" is a JSON body rather than an empty 200 response.
    return { recap: await this.daily.getYesterdayRecap() };
  }

  @UseGuards(JwtAuthGuard)
  @Get(":challengeId/me")
  me(@CurrentUser() user: AuthTokenPayload, @Param("challengeId") challengeId: string) {
    return this.daily.getMyEntry(challengeId, user.sub);
  }

  @Get(":challengeId/leaderboard")
  leaderboard(
    @Param("challengeId") challengeId: string,
    @Query(new ZodValidationPipe(dailyLeaderboardQuerySchema)) query: ReturnType<typeof dailyLeaderboardQuerySchema.parse>,
  ) {
    return this.daily.listLeaderboard(challengeId, query.limit);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":challengeId/submit")
  submit(
    @CurrentUser() user: AuthTokenPayload,
    @Param("challengeId") challengeId: string,
    @Body(new ZodValidationPipe(submitDailyAttemptSchema)) dto: SubmitDailyAttemptDto,
  ) {
    return this.daily.submitAttempt(challengeId, user.sub, dto);
  }
}
