import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { GuestDto, LoginDto, RegisterDto, UpgradeDto } from "./auth.schemas.js";

const SALT_ROUNDS = 12;

export interface AuthTokenPayload {
  sub: string;
  email: string | null;
}

interface UserRecord {
  id: string;
  email: string | null;
  displayName: string;
  isGuest: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with that email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, displayName: dto.displayName, isGuest: false },
    });

    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException("Invalid email or password");

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    return this.issueToken(user);
  }

  /** No email/password required — play immediately. */
  async guest(dto: GuestDto) {
    const user = await this.prisma.user.create({
      data: { displayName: dto.displayName, isGuest: true },
    });
    return this.issueToken(user);
  }

  /** Attaches email/password to the current (guest) account, on the same row, so its history persists. */
  async upgrade(userId: string, dto: UpgradeDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with that email already exists");

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { email: dto.email, passwordHash, isGuest: false },
    });

    return this.issueToken(user);
  }

  private issueToken(user: UserRecord) {
    const payload: AuthTokenPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, displayName: user.displayName, isGuest: user.isGuest },
    };
  }
}
