import { Inject, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { AuthTokenPayload } from "../auth/auth.service.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { DraftService } from "../draft/draft.service.js";
import { LiveDraftService } from "./live-draft.service.js";
import { isRoomComplete, pickAutoSelection, seatForPick, type AutoPickCandidate } from "./live-draft.logic.js";
import type { LeagueRules } from "../leagues/leagues.schemas.js";

const TURN_TIMEOUT_MS = 45_000;
const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

function readRules(rulesJson: unknown): LeagueRules {
  return rulesJson as LeagueRules;
}

/**
 * Real-time turn-based Live Draft (Phase 9b). Auth happens once per connection (a JWT off the
 * socket handshake, verified with the same JwtService/secret the REST JwtStrategy uses — there's no
 * Passport/Guard pipeline to hang onto a socket), not per-message; every message handler still
 * re-derives room/participant/turn state fresh from the DB rather than trusting anything cached on
 * the socket, since this is the only thing standing between "your turn" and a cheating client.
 */
@WebSocketGateway({ cors: { origin: "*" } })
export class LiveDraftGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(LiveDraftGateway.name);
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(WorldsService) private readonly worlds: WorldsService,
    @Inject(DraftService) private readonly draft: DraftService,
    @Inject(LiveDraftService) private readonly liveDraft: LiveDraftService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.["token"] as string | undefined;
    if (!token) {
      client.emit("error", { message: "Missing auth token" });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<AuthTokenPayload>(token, {
        secret: process.env["JWT_SECRET"] ?? "dev-secret-change-me",
      });
      client.data["user"] = payload;
    } catch {
      client.emit("error", { message: "Invalid or expired session" });
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // No presence/reconnect UI for v1 — a disconnected participant's turn still runs out via the
    // normal turn timer and gets auto-picked, same as anyone who's just gone idle without closing
    // the tab. Reconnecting and re-emitting "room:enter" picks the room's state back up fine.
  }

  private userOf(client: Socket): AuthTokenPayload {
    return client.data["user"] as AuthTokenPayload;
  }

  @SubscribeMessage("room:enter")
  async onRoomEnter(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }): Promise<void> {
    try {
      const room = await this.liveDraft.getRoomDetail(body.roomId, this.userOf(client).sub);
      await client.join(body.roomId);
      client.emit("room:state", this.serializeRoom(room));
    } catch (err) {
      client.emit("error", { message: err instanceof Error ? err.message : "Failed to join the room" });
    }
  }

  @SubscribeMessage("room:start")
  async onRoomStart(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }): Promise<void> {
    const userId = this.userOf(client).sub;
    try {
      const room = await this.liveDraft.getRoomDetail(body.roomId, userId);
      if (room.hostUserId !== userId) throw new Error("Only the host can start the draft");
      if (room.status !== "LOBBY") throw new Error("This room has already started");
      if (room.participants.length < 2) throw new Error("Need at least 2 participants to start");

      await this.prisma.liveDraftRoom.update({
        where: { id: room.id },
        data: { status: "IN_PROGRESS", currentPickNumber: 0, turnStartedAt: new Date() },
      });
      await this.broadcastState(room.id);
      this.scheduleTurnTimer(room.id);
    } catch (err) {
      client.emit("error", { message: err instanceof Error ? err.message : "Failed to start the draft" });
    }
  }

  @SubscribeMessage("draft:spin")
  async onDraftSpin(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }): Promise<void> {
    const userId = this.userOf(client).sub;
    try {
      const room = await this.liveDraft.getRoomDetail(body.roomId, userId);
      this.assertMyTurn(room, userId);

      const rules = readRules(room.league.rules);
      const clubSeasons = await this.prisma.refClubSeason.findMany({
        where: { league: { id: { in: rules.leagueIds } } },
        include: { club: true },
      });
      if (clubSeasons.length === 0) throw new Error("No clubs available for this room's rules");
      const club = clubSeasons[Math.floor(Math.random() * clubSeasons.length)]!;

      const draftedPlayerIds = new Set(room.picks.map((p) => p.playerId));
      const players = await this.prisma.refPlayerSeason.findMany({
        where: { clubSeasonId: club.id },
        include: { player: true },
      });
      const available = players.filter((p) => !draftedPlayerIds.has(p.playerId));

      this.server.to(room.id).emit("draft:spinResult", {
        club: { id: club.id, name: club.club.name, seasonYear: club.seasonYear },
        players: available.map((p) => ({
          id: p.id,
          playerId: p.playerId,
          name: p.player.name,
          nationality: p.player.nationality,
          photoUrl: p.player.photoUrl,
          positions: p.positions,
          overall: p.overall,
        })),
      });
    } catch (err) {
      client.emit("error", { message: err instanceof Error ? err.message : "Failed to spin" });
    }
  }

  @SubscribeMessage("draft:pick")
  async onDraftPick(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; refPlayerSeasonId: string },
  ): Promise<void> {
    const userId = this.userOf(client).sub;
    try {
      const room = await this.liveDraft.getRoomDetail(body.roomId, userId);
      this.assertMyTurn(room, userId);
      const participant = room.participants.find((p) => p.userId === userId)!;

      const season = await this.prisma.refPlayerSeason.findUnique({ where: { id: body.refPlayerSeasonId } });
      if (!season) throw new Error("That player wasn't found");
      if (room.picks.some((p) => p.playerId === season.playerId)) {
        throw new Error("That player has already been drafted in this room");
      }

      await this.prisma.liveDraftPick.create({
        data: {
          roomId: room.id,
          participantId: participant.id,
          pickNumber: room.currentPickNumber,
          refPlayerSeasonId: season.id,
          playerId: season.playerId,
        },
      });

      const nextPickNumber = room.currentPickNumber + 1;
      if (isRoomComplete(nextPickNumber, room.participants.length)) {
        this.clearTurnTimer(room.id);
        await this.prisma.liveDraftRoom.update({
          where: { id: room.id },
          data: { currentPickNumber: nextPickNumber, status: "COMPLETED", completedAt: new Date() },
        });
        await this.finalizeRoom(room.id);
      } else {
        await this.prisma.liveDraftRoom.update({
          where: { id: room.id },
          data: { currentPickNumber: nextPickNumber, turnStartedAt: new Date() },
        });
        await this.broadcastState(room.id);
        this.scheduleTurnTimer(room.id);
      }
    } catch (err) {
      client.emit("error", { message: err instanceof Error ? err.message : "Failed to draft that player" });
    }
  }

  private assertMyTurn(
    room: Awaited<ReturnType<LiveDraftService["getRoomDetail"]>>,
    userId: string,
  ): void {
    if (room.status !== "IN_PROGRESS") throw new Error("The draft hasn't started yet");
    const activeSeat = seatForPick(room.currentPickNumber, room.participants.length);
    const activeParticipant = room.participants.find((p) => p.seatIndex === activeSeat);
    if (!activeParticipant || activeParticipant.userId !== userId) throw new Error("It's not your turn");
  }

  private scheduleTurnTimer(roomId: string): void {
    this.clearTurnTimer(roomId);
    const timer = setTimeout(() => {
      void this.handleTurnTimeout(roomId);
    }, TURN_TIMEOUT_MS);
    this.turnTimers.set(roomId, timer);
  }

  private clearTurnTimer(roomId: string): void {
    const existing = this.turnTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.turnTimers.delete(roomId);
    }
  }

  /** Turn-timeout fallback — picks the highest-overall undrafted real player in the room's whole
      league pool for whoever's turn it currently is, no position targeting (see live-draft.logic.ts's
      pickAutoSelection doc comment). Re-derives the active participant fresh rather than trusting
      whatever triggered scheduleTurnTimer, in case a manual pick already landed in the meantime. */
  private async handleTurnTimeout(roomId: string): Promise<void> {
    try {
      const room = await this.prisma.liveDraftRoom.findUnique({
        where: { id: roomId },
        include: { league: true, participants: { orderBy: { seatIndex: "asc" } }, picks: true },
      });
      if (!room || room.status !== "IN_PROGRESS") return;

      const activeSeat = seatForPick(room.currentPickNumber, room.participants.length);
      const activeParticipant = room.participants.find((p) => p.seatIndex === activeSeat);
      if (!activeParticipant) return;

      const rules = readRules(room.league.rules);
      const draftedPlayerIds = new Set(room.picks.map((p) => p.playerId));
      const pool = await this.loadDedupedPool(rules.leagueIds);
      const pick = pickAutoSelection(pool, draftedPlayerIds);
      if (!pick) return; // pool exhausted — nothing left to auto-pick, let the room stall visibly rather than error

      await this.prisma.liveDraftPick.create({
        data: {
          roomId: room.id,
          participantId: activeParticipant.id,
          pickNumber: room.currentPickNumber,
          refPlayerSeasonId: pick.id,
          playerId: pick.playerId,
        },
      });

      const nextPickNumber = room.currentPickNumber + 1;
      if (isRoomComplete(nextPickNumber, room.participants.length)) {
        await this.prisma.liveDraftRoom.update({
          where: { id: room.id },
          data: { currentPickNumber: nextPickNumber, status: "COMPLETED", completedAt: new Date() },
        });
        await this.finalizeRoom(room.id);
      } else {
        await this.prisma.liveDraftRoom.update({
          where: { id: room.id },
          data: { currentPickNumber: nextPickNumber, turnStartedAt: new Date() },
        });
        await this.broadcastState(room.id);
        this.scheduleTurnTimer(room.id);
      }
    } catch (err) {
      this.logger.error(`Turn-timeout auto-pick failed for room ${roomId}`, err instanceof Error ? err.stack : undefined);
    }
  }

  /** One canonical row per real person (their best season), scoped to the room's real league(s) —
      the same dedupe convention daily.service.ts's loadPool uses, for the same reason: a shared
      pool reasons about people, not individual RefPlayerSeason rows. */
  private async loadDedupedPool(leagueIds: string[]): Promise<AutoPickCandidate[]> {
    const rows = await this.prisma.refPlayerSeason.findMany({
      where: { clubSeason: { league: { id: { in: leagueIds }, country: { in: REAL_LEAGUE_COUNTRIES } } } },
      orderBy: { overall: "desc" },
    });
    const seen = new Set<string>();
    const pool: AutoPickCandidate[] = [];
    for (const row of rows) {
      if (seen.has(row.playerId)) continue;
      seen.add(row.playerId);
      pool.push({ id: row.id, playerId: row.playerId, overall: row.overall });
    }
    return pool;
  }

  /** Submits every participant's picks through the exact same DraftService.draftFantasy path a
      solo/async-league draft already uses, tagged with this room's backing league — from here on,
      simulation and standings are 100% reused Phase 9a infrastructure. A participant whose picks
      can't fill the formation (buildLineup throws) is reported as an error for THEM specifically;
      it doesn't fail the whole room — everyone else's world still gets created. */
  private async finalizeRoom(roomId: string): Promise<void> {
    const room = await this.prisma.liveDraftRoom.findUnique({
      where: { id: roomId },
      include: { league: true, participants: true, picks: true },
    });
    if (!room) return;
    const rules = readRules(room.league.rules);

    const picksByParticipant = new Map<string, string[]>();
    for (const pick of room.picks) {
      const list = picksByParticipant.get(pick.participantId) ?? [];
      list.push(pick.refPlayerSeasonId);
      picksByParticipant.set(pick.participantId, list);
    }

    const results: { userId: string; worldId?: string; error?: string }[] = [];
    for (const participant of room.participants) {
      const refPlayerSeasonIds = picksByParticipant.get(participant.id) ?? [];
      try {
        const world = await this.worlds.createWorld(participant.userId, {
          eraId: rules.eraId,
          type: "SINGLE",
          settings: { europeanNights: true, januaryWindow: true, multiplayerLeagueId: room.leagueId },
        });
        await this.draft.draftFantasy(world.id, participant.userId, {
          name: `${participant.displayName}'s XI`,
          formation: rules.formation as Parameters<DraftService["draftFantasy"]>[2]["formation"],
          refPlayerSeasonIds,
        });
        await this.prisma.liveDraftParticipant.update({ where: { id: participant.id }, data: { worldId: world.id } });
        results.push({ userId: participant.userId, worldId: world.id });
      } catch (err) {
        this.logger.warn(`Live draft finalize failed for participant ${participant.id}: ${err instanceof Error ? err.message : err}`);
        results.push({ userId: participant.userId, error: err instanceof Error ? err.message : "Failed to build your squad" });
      }
    }

    this.server.to(room.id).emit("room:complete", { results });
  }

  /** Public (not just called from within this gateway's own handlers) — LiveDraftController calls
      this after a REST-driven join, since joining happens over plain HTTP with no socket of its own
      to broadcast from; without this, participants already sitting in the lobby wouldn't see a new
      arrival until they manually refreshed. */
  async broadcastState(roomId: string): Promise<void> {
    const room = await this.prisma.liveDraftRoom.findUnique({
      where: { id: roomId },
      include: {
        league: true,
        participants: { orderBy: { seatIndex: "asc" } },
        picks: { orderBy: { pickNumber: "asc" } },
      },
    });
    if (!room) return;
    this.server.to(roomId).emit("room:state", this.serializeRoom(room));
  }

  private serializeRoom(room: Awaited<ReturnType<LiveDraftService["getRoomDetail"]>>) {
    const activeSeat =
      room.status === "IN_PROGRESS" ? seatForPick(room.currentPickNumber, room.participants.length) : null;
    return {
      id: room.id,
      status: room.status,
      hostUserId: room.hostUserId,
      maxSeats: room.maxSeats,
      currentPickNumber: room.currentPickNumber,
      turnStartedAt: room.turnStartedAt?.toISOString() ?? null,
      turnTimeoutMs: TURN_TIMEOUT_MS,
      rules: readRules(room.league.rules),
      participants: room.participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        isActive: p.seatIndex === activeSeat,
        pickCount: room.picks.filter((pick) => pick.participantId === p.id).length,
      })),
      picks: room.picks.map((p) => ({
        pickNumber: p.pickNumber,
        participantId: p.participantId,
        refPlayerSeasonId: p.refPlayerSeasonId,
        playerId: p.playerId,
      })),
    };
  }
}
