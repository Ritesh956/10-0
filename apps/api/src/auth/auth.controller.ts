import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import type { AuthTokenPayload } from "./auth.service.js";
import {
  guestSchema,
  loginSchema,
  registerSchema,
  upgradeSchema,
  type GuestDto,
  type LoginDto,
  type RegisterDto,
  type UpgradeDto,
} from "./auth.schemas.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { CurrentUser } from "./current-user.decorator.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Play immediately with just a display name — no email/password needed. */
  @Post("guest")
  guest(@Body(new ZodValidationPipe(guestSchema)) dto: GuestDto) {
    return this.authService.guest(dto);
  }

  /** Attaches email/password to the current session so its history persists. */
  @UseGuards(JwtAuthGuard)
  @Post("upgrade")
  upgrade(
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(upgradeSchema)) dto: UpgradeDto,
  ) {
    return this.authService.upgrade(user.sub, dto);
  }
}
