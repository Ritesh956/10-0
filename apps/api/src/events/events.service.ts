import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import { buildInviteCode, rankStandings } from "../leagues/leagues.logic.js";
import { EVENT_TEMPLATES, eventKey, isoWeekKey, weekEndsAt, type EventTemplate } from "./events.logic.js";

export interface WeeklyEventDto {
  key: string;
  week: string;
  leagueId: string;
  name: string;
  twist: string;
  difficulty: EventTemplate["difficulty"];
  formation: string | null;
  /** The invite code of the event's league — the web app joins through the normal invite flow. */
  inviteCode: string;
  endsAt: string;
  memberCount: number;
  /** Players who've finished a season in the event, best first. */
  top: { rank: number; handle: string; points: number; goalDiff: number }[];
}

/**
 * This week's public events — one per league. Each is an ordinary MultiplayerLeague (so joining,
 * the locked draft rules, and standings all reuse the Leagues flow) created by the server the first
 * time the week's events are asked for, and tagged `rules.event` so it can be found again.
 */
@Injectable()
export class EventsService {
  /** One in-flight creation per event key, so a burst of first requests can't make duplicates. */
  private readonly creating = new Map<string, Promise<{ id: string; inviteCode: string }>>();

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async current(now = new Date()): Promise<WeeklyEventDto[]> {
    const week = isoWeekKey(now);
    const endsAt = weekEndsAt(now).toISOString();
    const events = await Promise.all(
      EVENT_TEMPLATES.map(async (template) => {
        const league = await this.ensureLeague(week, template);
        if (!league) return null;
        const { memberCount, top } = await this.standings(league.id);
        const dto: WeeklyEventDto = {
          key: eventKey(week, template.leagueId),
          week,
          leagueId: template.leagueId,
          name: template.name,
          twist: template.twist,
          difficulty: template.difficulty,
          formation: template.formation ?? null,
          inviteCode: league.inviteCode,
          endsAt,
          memberCount,
          top,
        };
        return dto;
      }),
    );
    return events.filter((e): e is WeeklyEventDto => e !== null);
  }

  private async ensureLeague(week: string, template: EventTemplate) {
    const key = eventKey(week, template.leagueId);
    const found = await this.find(key);
    if (found) return found;
    const pending = this.creating.get(key);
    if (pending) return pending;

    const creation = (async () => {
      const refLeague = await this.prisma.refLeague.findUnique({ where: { id: template.leagueId }, select: { eraId: true } });
      if (!refLeague) return null;
      const again = await this.find(key);
      if (again) return again;
      const rules = {
        eraId: refLeague.eraId,
        leagueIds: [template.leagueId],
        difficulty: template.difficulty,
        formationFreedom: !template.formation,
        ...(template.formation ? { formation: template.formation } : {}),
        event: { key, week, name: template.name, twist: template.twist },
      };
      const inviteCode = await this.freshInviteCode();
      const league = await this.prisma.multiplayerLeague.create({
        data: { name: template.name, creatorId: "system", inviteCode, rules: rules as unknown as object },
      });
      return { id: league.id, inviteCode: league.inviteCode };
    })().finally(() => this.creating.delete(key));
    this.creating.set(key, creation as Promise<{ id: string; inviteCode: string }>);
    return creation;
  }

  private find(key: string) {
    return this.prisma.multiplayerLeague.findFirst({
      where: { rules: { path: ["event", "key"], equals: key } },
      select: { id: true, inviteCode: true },
    });
  }

  private async freshInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = buildInviteCode(randomBytes(8));
      if (!(await this.prisma.multiplayerLeague.findUnique({ where: { inviteCode: code } }))) return code;
    }
    throw new Error("Failed to generate a unique invite code");
  }

  private async standings(leagueId: string) {
    const memberships = await this.prisma.leagueMembership.findMany({ where: { leagueId } });
    const worldIds = memberships.map((m) => m.worldId).filter((id): id is string => Boolean(id));
    const entries = worldIds.length ? await this.prisma.leaderboardEntry.findMany({ where: { worldId: { in: worldIds } } }) : [];
    const byWorld = new Map(entries.map((e) => [e.worldId, e]));
    const ranked = rankStandings(
      memberships.map((m) => ({ userId: m.userId, worldId: m.worldId, entry: m.worldId ? (byWorld.get(m.worldId) ?? null) : null })),
    );
    const top = ranked
      .filter((r) => r.entry !== null && r.rank !== null)
      .slice(0, 3)
      .map((r) => ({ rank: r.rank!, handle: r.entry!.handle, points: r.entry!.points, goalDiff: r.entry!.goalDiff }));
    return { memberCount: memberships.length, top };
  }
}
