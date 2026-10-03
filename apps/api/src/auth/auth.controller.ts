import { Body, Controller, Get, Headers, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import type { AuthTokenPayload } from "./auth.service.js";
import {
  guestSchema,
  loginSchema,
  registerSchema,
  upgradeSchema,
  googleSignInSchema,
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  type GoogleSignInDto,
  type MagicLinkRequestDto,
  type MagicLinkVerifyDto,
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
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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

  /** Which passwordless methods are available (Google only once GOOGLE_CLIENT_ID is set). */
  @Get("providers")
  providers() {
    return this.authService.providers();
  }

  /** Emails a one-time sign-in link. A guest session (optional Bearer token) becomes the account. */
  @Post("magic-link")
  @HttpCode(202)
  requestMagicLink(
    @Headers("authorization") authorization: string | undefined,
    @Body(new ZodValidationPipe(magicLinkRequestSchema)) dto: MagicLinkRequestDto,
  ) {
    return this.authService.requestMagicLink(dto.email, this.authService.optionalUserId(authorization), dto.redirect);
  }

  @Post("magic-link/verify")
  @HttpCode(200)
  verifyMagicLink(@Body(new ZodValidationPipe(magicLinkVerifySchema)) dto: MagicLinkVerifyDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  @Post("google")
  @HttpCode(200)
  google(
    @Headers("authorization") authorization: string | undefined,
    @Body(new ZodValidationPipe(googleSignInSchema)) dto: GoogleSignInDto,
  ) {
    return this.authService.signInWithGoogle(dto.credential, this.authService.optionalUserId(authorization));
  }
}
