import { randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import { buildInviteCode } from "../leagues/leagues.logic.js";
import type { LeagueRules } from "../leagues/leagues.schemas.js";
import type { CreateLiveDraftRoomDto } from "./live-draft.schemas.js";

const MAX_INVITE_CODE_ATTEMPTS = 5;

@Injectable()
export class LiveDraftService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Spawns a backing MultiplayerLeague (formationFreedom always false — see schema comment) and
      auto-seats the host at seat 0, same "creator is trivially their own first member" convention
      LeaguesService.createLeague already established. */
  async createRoom(userId: string, dto: CreateLiveDraftRoomDto) {
    const displayName = await this.getDisplayName(userId);
    const rules: LeagueRules = {
      eraId: dto.eraId,
      leagueIds: dto.leagueIds,
      difficulty: dto.difficulty,
      formationFreedom: false,
      formation: dto.formation,
    };
    const league = await this.prisma.multiplayerLeague.create({
      data: {
        name: dto.name,
        creatorId: userId,
        inviteCode: await this.generateUniqueCode("league"),
        rules: rules as unknown as object,
      },
    });
    const room = await this.prisma.liveDraftRoom.create({
      data: {
        leagueId: league.id,
        hostUserId: userId,
        inviteCode: await this.generateUniqueCode("room"),
        maxSeats: dto.maxSeats,
      },
    });
    await this.prisma.liveDraftParticipant.create({
      data: { roomId: room.id, userId, displayName, seatIndex: 0 },
    });
    return this.getRoomDetail(room.id, userId);
  }

  private async getDisplayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return user.displayName;
  }

  /** Collision retry is a formality — same reasoning as LeaguesService's own copy of this pattern
      (kept separate rather than shared since it's an 8-line loop over two different tables). */
  private async generateUniqueCode(kind: "league" | "room"): Promise<string> {
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
      const code = buildInviteCode(randomBytes(8));
      const existing =
        kind === "league"
          ? await this.prisma.multiplayerLeague.findUnique({ where: { inviteCode: code } })
          : await this.prisma.liveDraftRoom.findUnique({ where: { inviteCode: code } });
      if (!existing) return code;
    }
    throw new Error("Failed to generate a unique invite code");
  }

  /** Public, unguarded read (matches leagues' invite-preview convention) — lets a join-by-link
      landing page show the room before the visitor has signed in. */
  async getByInviteCode(inviteCode: string) {
    const room = await this.prisma.liveDraftRoom.findUnique({
      where: { inviteCode },
      include: { league: true, participants: { orderBy: { seatIndex: "asc" } } },
    });
    if (!room) throw new NotFoundException("Live draft room not found — check the invite link");
    return room;
  }

  /** Idempotent for an existing participant (rejoining just returns their existing seat). A race
      between two simultaneous joins landing on the same seatIndex is caught by the
      @@unique([roomId, seatIndex]) constraint — the loser gets a plain DB error and can retry; not
      worth a serializable transaction for a ≤4-seat, invite-only room. */
  async joinRoom(inviteCode: string, userId: string) {
    const room = await this.getByInviteCode(inviteCode);
    const existing = room.participants.find((p) => p.userId === userId);
    if (existing) return { room, participant: existing };
    if (room.status !== "LOBBY") throw new BadRequestException("This room has already started drafting");
    if (room.participants.length >= room.maxSeats) throw new BadRequestException("This room is full");

    const displayName = await this.getDisplayName(userId);
    const participant = await this.prisma.liveDraftParticipant.create({
      data: { roomId: room.id, userId, displayName, seatIndex: room.participants.length },
    });
    return { room, participant };
  }

  async getRoomDetail(roomId: string, userId: string) {
    const room = await this.prisma.liveDraftRoom.findUnique({
      where: { id: roomId },
      include: {
        league: true,
        participants: { orderBy: { seatIndex: "asc" } },
        picks: { orderBy: { pickNumber: "asc" } },
      },
    });
    if (!room) throw new NotFoundException("Live draft room not found");
    if (!room.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException("You're not a participant in this room");
    }
    return room;
  }

  async listMine(userId: string) {
    const participations = await this.prisma.liveDraftParticipant.findMany({
      where: { userId },
      // participants included here too — every LiveDraftRoomDto consumer (this list, invite
      // preview, room detail) assumes .participants is always present, never optional.
      include: { room: { include: { league: true, participants: { orderBy: { seatIndex: "asc" } } } } },
      orderBy: { joinedAt: "desc" },
    });
    return participations.map((p) => p.room);
  }
}
