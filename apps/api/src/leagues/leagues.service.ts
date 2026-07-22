import { randomBytes } from "node:crypto";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import { buildInviteCode, rankStandings } from "./leagues.logic.js";
import type { CreateLeagueDto, LeagueRules } from "./leagues.schemas.js";

const MAX_INVITE_CODE_ATTEMPTS = 5;

@Injectable()
export class LeaguesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Creates the league and auto-joins its own creator (a creator who never joined their own league
      would be a strange, easy-to-miss gap — nobody starting a league expects an extra "now join it
      yourself" step). */
  async createLeague(userId: string, dto: CreateLeagueDto) {
    const inviteCode = await this.generateUniqueInviteCode();
    const rules: LeagueRules = {
      eraId: dto.eraId,
      leagueIds: dto.leagueIds,
      difficulty: dto.difficulty,
      formationFreedom: dto.formationFreedom,
      ...(dto.formation ? { formation: dto.formation } : {}),
    };
    const league = await this.prisma.multiplayerLeague.create({
      data: { name: dto.name, creatorId: userId, inviteCode, rules: rules as unknown as object },
    });
    await this.prisma.leagueMembership.create({ data: { leagueId: league.id, userId } });
    return league;
  }

  /** Collision retry is a formality, not a real-world concern — INVITE_CODE_ALPHABET (32 chars) ^ 8
      is billions of combinations against what will realistically ever be a small table. */
  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
      const code = buildInviteCode(randomBytes(8));
      const existing = await this.prisma.multiplayerLeague.findUnique({ where: { inviteCode: code } });
      if (!existing) return code;
    }
    throw new Error("Failed to generate a unique invite code");
  }

  /** Public, unguarded read (matches catalog/leaderboard's "openly readable" convention) — lets a
      join-by-link landing page preview the league's rules before the visitor has even signed in as
      a guest. */
  async getByInviteCode(inviteCode: string) {
    const league = await this.prisma.multiplayerLeague.findUnique({ where: { inviteCode } });
    if (!league) throw new NotFoundException("League not found — check the invite link");
    return league;
  }

  /** Idempotent — opening the same invite link twice (or clicking "Join" after already being a
      member) just returns the existing membership rather than erroring. */
  async joinLeague(inviteCode: string, userId: string) {
    const league = await this.getByInviteCode(inviteCode);
    const membership = await this.prisma.leagueMembership.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId } },
      create: { leagueId: league.id, userId },
      update: {},
    });
    return { league, membership };
  }

  private async requireMembership(leagueId: string, userId: string) {
    const membership = await this.prisma.leagueMembership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) throw new ForbiddenException("You're not a member of this league");
    return membership;
  }

  async getLeague(leagueId: string, userId: string) {
    await this.requireMembership(leagueId, userId);
    const league = await this.prisma.multiplayerLeague.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException("League not found");
    return league;
  }

  async listMine(userId: string) {
    const memberships = await this.prisma.leagueMembership.findMany({
      where: { userId },
      include: { league: true },
      orderBy: { joinedAt: "desc" },
    });
    return memberships.map((m) => m.league);
  }

  /**
   * Ranks every member by their submitted domestic-season result — joins LeagueMembership to
   * LeaderboardEntry by worldId rather than storing season results twice. A member only has an
   * entry once their run reaches the results screen and finalizeRun/submitToLeaderboard has fired
   * (SeasonPage auto-submits for any world tagged with this league — see World.settings.
   * multiplayerLeagueId), so "no entry yet" is a normal, expected state mid-league, not an error.
   */
  async getStandings(leagueId: string, userId: string) {
    await this.requireMembership(leagueId, userId);
    const memberships = await this.prisma.leagueMembership.findMany({ where: { leagueId } });
    const worldIds = memberships.map((m) => m.worldId).filter((id): id is string => Boolean(id));
    const entries = worldIds.length
      ? await this.prisma.leaderboardEntry.findMany({ where: { worldId: { in: worldIds } } })
      : [];
    const entryByWorldId = new Map(entries.map((e) => [e.worldId, e]));

    return rankStandings(
      memberships.map((m) => ({
        userId: m.userId,
        worldId: m.worldId,
        entry: m.worldId ? (entryByWorldId.get(m.worldId) ?? null) : null,
      })),
    );
  }
}
