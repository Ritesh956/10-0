import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { ProfileService } from "./profile.service.js";

@UseGuards(JwtAuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthTokenPayload) {
    return this.profile.getProfile(user.sub);
  }
}
