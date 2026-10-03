import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { GuestDto, LoginDto, RegisterDto, UpgradeDto } from "./auth.schemas.js";
import { Mailer } from "./mailer.js";
import {
  checkGoogleClaims,
  decideAccount,
  displayNameFromEmail,
  hashToken,
  MAGIC_LINK_MAX_PER_WINDOW,
  MAGIC_LINK_TTL_MS,
  newMagicToken,
  normalizeEmail,
  type AccountDecision,
  type GoogleTokenInfo,
} from "./passwordless.logic.js";

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
    @Inject(Mailer) private readonly mailer: Mailer,
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

  /** The user id behind an optional "Bearer …" header, or null (absent, malformed or expired) —
      the passwordless routes are public but behave better when a guest session is present. */
  optionalUserId(authorization: string | undefined): string | null {
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return null;
    try {
      return this.jwt.verify<AuthTokenPayload>(token).sub;
    } catch {
      return null;
    }
  }

  /** Which sign-in methods this server can offer — Google only once a client id is configured. */
  providers() {
    const googleClientId = process.env["GOOGLE_CLIENT_ID"] || null;
    return { emailLink: true, google: Boolean(googleClientId), googleClientId };
  }

  /** Emails a one-time sign-in link. Always answers the same way whether or not the address has an
      account, so the endpoint can't be used to find out who plays. */
  async requestMagicLink(rawEmail: string, guestUserId: string | null, redirect: string | undefined) {
    const email = normalizeEmail(rawEmail);
    const recent = await this.prisma.magicLinkToken.count({
      where: { email, createdAt: { gt: new Date(Date.now() - MAGIC_LINK_TTL_MS) } },
    });
    if (recent >= MAGIC_LINK_MAX_PER_WINDOW) {
      throw new HttpException("Too many sign-in links requested — try again in a few minutes", HttpStatus.TOO_MANY_REQUESTS);
    }
    const token = newMagicToken();
    await this.prisma.magicLinkToken.create({
      data: { email, tokenHash: hashToken(token), guestUserId, expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS) },
    });
    const webUrl = (process.env["WEB_URL"] ?? "http://localhost:5173").replace(/\/$/, "");
    const next = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? `&next=${encodeURIComponent(redirect)}` : "";
    await this.mailer.sendMagicLink(email, `${webUrl}/auth/magic?token=${token}${next}`);
    return { sent: true };
  }

  async verifyMagicLink(token: string) {
    const row = await this.prisma.magicLinkToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("This sign-in link has expired or was already used — request a new one");
    }
    // Claim it atomically: a second click (or a mail scanner prefetching the link) can't reuse it.
    const claimed = await this.prisma.magicLinkToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw new UnauthorizedException("This sign-in link was already used — request a new one");

    const [existing, guest] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: row.email } }),
      row.guestUserId ? this.prisma.user.findUnique({ where: { id: row.guestUserId } }) : Promise.resolve(null),
    ]);
    const user = await this.applyDecision(decideAccount(existing, guest), {
      email: row.email,
      displayName: displayNameFromEmail(row.email),
    });
    return this.issueToken(user);
  }

  /** Sign in with Google: verifies the ID token from Google Identity Services against this app's
      client id, then applies the same account rules as a magic link (matching on the Google id
      first, then on the verified email). */
  async signInWithGoogle(credential: string, guestUserId: string | null) {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    if (!clientId) throw new ServiceUnavailableException("Google sign-in isn't configured on this server");
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) throw new UnauthorizedException("Google didn't accept that sign-in");
    const claims = checkGoogleClaims((await res.json()) as GoogleTokenInfo, clientId, Math.floor(Date.now() / 1000));
    if (!claims.ok) throw new UnauthorizedException(claims.reason);

    const [byGoogle, byEmail, guest] = await Promise.all([
      this.prisma.user.findUnique({ where: { googleId: claims.sub } }),
      this.prisma.user.findUnique({ where: { email: claims.email } }),
      guestUserId ? this.prisma.user.findUnique({ where: { id: guestUserId } }) : Promise.resolve(null),
    ]);
    const user = await this.applyDecision(decideAccount(byGoogle ?? byEmail, guest), {
      email: claims.email,
      displayName: claims.name ?? displayNameFromEmail(claims.email),
      googleId: claims.sub,
    });
    return this.issueToken(user);
  }

  private async applyDecision(
    decision: AccountDecision,
    identity: { email: string; displayName: string; googleId?: string },
  ): Promise<UserRecord> {
    const link = identity.googleId ? { googleId: identity.googleId } : {};
    if (decision.action === "create") {
      return this.prisma.user.create({
        data: { email: identity.email, displayName: identity.displayName.slice(0, 40), isGuest: false, ...link },
      });
    }
    if (decision.action === "upgrade-guest") {
      // The guest keeps the name they've been playing under.
      return this.prisma.user.update({ where: { id: decision.userId }, data: { email: identity.email, isGuest: false, ...link } });
    }
    if (decision.mergeGuestId) await this.mergeGuestInto(decision.mergeGuestId, decision.userId);
    return this.prisma.user.update({ where: { id: decision.userId }, data: link });
  }

  /** Moves a guest's runs, trophies and leaderboard entries onto the account they signed into.
      Daily entries and league memberships move only where the account doesn't already have one for
      that challenge/league (both are one-per-user). The emptied guest row is left in place. */
  private async mergeGuestInto(guestId: string, userId: string) {
    const [accountDailies, accountLeagues] = await Promise.all([
      this.prisma.dailyChallengeEntry.findMany({ where: { userId }, select: { dailyChallengeId: true } }),
      this.prisma.leagueMembership.findMany({ where: { userId }, select: { leagueId: true } }),
    ]);
    await this.prisma.$transaction([
      this.prisma.world.updateMany({ where: { ownerId: guestId }, data: { ownerId: userId } }),
      this.prisma.worldClub.updateMany({ where: { managedByUserId: guestId }, data: { managedByUserId: userId } }),
      this.prisma.achievement.updateMany({ where: { userId: guestId }, data: { userId } }),
      this.prisma.leaderboardEntry.updateMany({ where: { userId: guestId }, data: { userId } }),
      this.prisma.dailyChallengeEntry.updateMany({
        where: { userId: guestId, dailyChallengeId: { notIn: accountDailies.map((d) => d.dailyChallengeId) } },
        data: { userId },
      }),
      this.prisma.leagueMembership.updateMany({
        where: { userId: guestId, leagueId: { notIn: accountLeagues.map((l) => l.leagueId) } },
        data: { userId },
      }),
    ]);
  }

  private issueToken(user: UserRecord) {
    const payload: AuthTokenPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, displayName: user.displayName, isGuest: user.isGuest },
    };
  }
}
