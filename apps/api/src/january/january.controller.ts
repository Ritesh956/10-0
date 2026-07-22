import { Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { JanuaryService } from "./january.service.js";

@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/january")
export class JanuaryController {
  constructor(@Inject(JanuaryService) private readonly january: JanuaryService) {}

  @Post(":seasonId/resolve")
  resolve(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("seasonId") seasonId: string,
  ) {
    return this.january.resolveGamble(worldId, seasonId, user.sub);
  }
}
