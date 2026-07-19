import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { WorldsService } from "./worlds.service.js";
import { createWorldSchema, type CreateWorldDto } from "./worlds.schemas.js";

@UseGuards(JwtAuthGuard)
@Controller("worlds")
export class WorldsController {
  constructor(@Inject(WorldsService) private readonly worlds: WorldsService) {}

  @Post()
  create(@CurrentUser() user: AuthTokenPayload, @Body(new ZodValidationPipe(createWorldSchema)) dto: CreateWorldDto) {
    return this.worlds.createWorld(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.worlds.listWorlds(user.sub);
  }

  @Get(":worldId")
  get(@CurrentUser() user: AuthTokenPayload, @Param("worldId") worldId: string) {
    return this.worlds.getWorld(worldId, user.sub);
  }
}
