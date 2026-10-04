import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { JanuaryService } from "./january.service.js";

const resolveJanuarySchema = z.object({
  /** For a choice event (Wheeler Dealer): which of the offered players to sign. */
  choiceId: z.string().optional(),
});
type ResolveJanuaryDto = z.infer<typeof resolveJanuarySchema>;

@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/january")
export class JanuaryController {
  constructor(@Inject(JanuaryService) private readonly january: JanuaryService) {}

  /** This season's event (and blind options, if it's a choice event) — the same every time it's asked. */
  @Get(":seasonId/offer")
  offer(@CurrentUser() user: AuthTokenPayload, @Param("worldId") worldId: string, @Param("seasonId") seasonId: string) {
    return this.january.getOffer(worldId, seasonId, user.sub);
  }

  @Post(":seasonId/resolve")
  resolve(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Param("seasonId") seasonId: string,
    @Body(new ZodValidationPipe(resolveJanuarySchema)) dto: ResolveJanuaryDto,
  ) {
    return this.january.resolveGamble(worldId, seasonId, user.sub, dto?.choiceId);
  }
}
