import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { LiveDraftService } from "./live-draft.service.js";
import { LiveDraftGateway } from "./live-draft.gateway.js";
import { createLiveDraftRoomSchema, type CreateLiveDraftRoomDto } from "./live-draft.schemas.js";

/** Unguarded — same reasoning as LeaguesPublicController: previewing a room from a shared invite
    link shouldn't require signing in first. Joining and everything else still requires auth. */
@Controller("live-draft")
export class LiveDraftPublicController {
  constructor(@Inject(LiveDraftService) private readonly liveDraft: LiveDraftService) {}

  @Get("invite/:code")
  preview(@Param("code") code: string) {
    return this.liveDraft.getByInviteCode(code);
  }
}

@UseGuards(JwtAuthGuard)
@Controller("live-draft")
export class LiveDraftController {
  constructor(
    @Inject(LiveDraftService) private readonly liveDraft: LiveDraftService,
    @Inject(LiveDraftGateway) private readonly gateway: LiveDraftGateway,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body(new ZodValidationPipe(createLiveDraftRoomSchema)) dto: CreateLiveDraftRoomDto) {
    return this.liveDraft.createRoom(user.sub, dto);
  }

  // Registered before ":roomId" — same registration-order gotcha as GET /worlds/history and
  // GET /leagues/mine (CLAUDE.md/leagues.controller.ts already document this pattern).
  @Get("mine")
  mine(@CurrentUser() user: AuthTokenPayload) {
    return this.liveDraft.listMine(user.sub);
  }

  // Joining is plain HTTP, not a socket message, so there's nothing to broadcast FROM — explicitly
  // push a fresh room:state after a successful join so anyone already sitting in the lobby sees the
  // new arrival immediately instead of only on their next manual refresh.
  @Post("invite/:code/join")
  async join(@CurrentUser() user: AuthTokenPayload, @Param("code") code: string) {
    const result = await this.liveDraft.joinRoom(code, user.sub);
    await this.gateway.broadcastState(result.room.id);
    return result;
  }

  @Get(":roomId")
  get(@CurrentUser() user: AuthTokenPayload, @Param("roomId") roomId: string) {
    return this.liveDraft.getRoomDetail(roomId, user.sub);
  }
}
