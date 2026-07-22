import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtStrategy } from "./jwt.strategy.js";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env["JWT_SECRET"] ?? "dev-secret-change-me",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtModule re-exported so other modules can inject JwtService directly — live-draft.gateway.ts
  // needs it to verify a token off a WebSocket handshake (no @UseGuards/Passport request pipeline
  // to hang a guard off, unlike every REST controller).
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
