import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { DraftService } from "./draft.service.js";
import { draftClubSchema, draftFantasySchema, type DraftClubDto, type DraftFantasyDto } from "./draft.schemas.js";

@UseGuards(JwtAuthGuard)
@Controller("worlds/:worldId/draft")
export class DraftController {
  constructor(@Inject(DraftService) private readonly draft: DraftService) {}

  @Post("club")
  draftClub(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Body(new ZodValidationPipe(draftClubSchema)) dto: DraftClubDto,
  ) {
    return this.draft.draftClub(worldId, user.sub, dto);
  }

  @Post("fantasy")
  draftFantasy(
    @CurrentUser() user: AuthTokenPayload,
    @Param("worldId") worldId: string,
    @Body(new ZodValidationPipe(draftFantasySchema)) dto: DraftFantasyDto,
  ) {
    return this.draft.draftFantasy(worldId, user.sub, dto);
  }
}
