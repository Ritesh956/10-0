import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import {
  biasPoolForEvent,
  findWeakestSlot,
  pickEventType,
  totalEventWeight,
  type JanuaryEventType,
  type LineupSlotJson,
} from "./january.logic.js";

interface WorldSettingsShape {
  europeanNights?: boolean;
  januaryWindow?: boolean;
}

function rollEventType(): JanuaryEventType {
  return pickEventType(randomInt(totalEventWeight()));
}

export interface JanuaryResult {
  eventType: JanuaryEventType;
  outPlayer: { id: string; name: string; overall: number; position: string };
  inPlayer: { id: string; name: string; overall: number; position: string; clubName: string; seasonYear: number };
  delta: number;
}

/**
 * Resolves one club's January Transfer Window gamble: finds the weakest-rated occupied lineup
 * slot, rolls an event type, draws a replacement RefPlayerSeason for that position (scoped to the
 * world's era and, when the club has one, its own league), instantiates a WorldPlayer for the
 * incoming player (same field mapping as instantiate-world-club.ts), patches the lineup slot, and
 * persists a JanuaryEvent (+ a Transfer row for audit) — all inside one transaction. The
 * `@@unique([seasonId, clubId])` constraint on JanuaryEvent is the idempotency guard: a club's
 * window can only be resolved once per season.
 */
@Injectable()
export class JanuaryService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
  ) {}

  async resolveGamble(worldId: string, seasonId: string, userId: string): Promise<JanuaryResult> {
    const world = await this.worlds.getWorld(worldId, userId);
    const settings = (world.settings as WorldSettingsShape | null) ?? {};
    if (settings.januaryWindow === false) {
      throw new BadRequestException("The January Transfer Window is off for this world");
    }

    const season = await this.prisma.season.findFirst({ where: { id: seasonId, worldId } });
    if (!season) throw new NotFoundException("Season not found");

    const club = world.clubs.find((c) => c.managedByUserId === userId);
    if (!club) throw new NotFoundException("You don't manage a club in this world");

    const existing = await this.prisma.januaryEvent.findUnique({
      where: { seasonId_clubId: { seasonId, clubId: club.id } },
    });
    if (existing) throw new BadRequestException("This club's January window has already been resolved");

    const lineup = ((club.lineup as LineupSlotJson[] | null) ?? []).filter((s) => Boolean(s?.playerId));
    if (lineup.length === 0) throw new BadRequestException("Club has no lineup to swap from");

    const worldPlayers = await this.prisma.worldPlayer.findMany({
      where: { id: { in: lineup.map((s) => s.playerId) } },
    });
    const playerById = new Map(worldPlayers.map((p) => [p.id, p]));

    const weakest = findWeakestSlot(lineup, playerById);
    if (!weakest) {
      throw new BadRequestException("Could not determine a slot to strengthen");
    }
    const { slot: weakestSlot, player: weakestPlayer } = weakest;

    const eventType = rollEventType();

    const ownedRefPlayerSeasonIds = worldPlayers.map((p) => p.refPlayerSeasonId);
    const clubLeagueId = club.refClubSeasonId
      ? (
          await this.prisma.refClubSeason.findUnique({
            where: { id: club.refClubSeasonId },
            select: { leagueId: true },
          })
        )?.leagueId
      : undefined;

    const basePool = await this.prisma.refPlayerSeason.findMany({
      where: {
        positions: { hasSome: [weakestSlot.position] },
        id: { notIn: ownedRefPlayerSeasonIds },
        clubSeason: {
          league: {
            eraId: world.eraId,
            ...(clubLeagueId ? { id: clubLeagueId } : {}),
          },
        },
      },
      include: { player: true, clubSeason: { include: { club: true } } },
    });
    if (basePool.length === 0) {
      throw new NotFoundException("No eligible replacement players found for that position");
    }

    const pool = biasPoolForEvent(basePool, eventType, weakestPlayer.overall);
    const drawn = pool[randomInt(pool.length)]!;

    const event = await this.prisma.$transaction(async (tx) => {
      const incoming = await tx.worldPlayer.create({
        data: {
          worldId,
          clubId: club.id,
          refPlayerSeasonId: drawn.id,
          name: drawn.player.name,
          photoUrl: drawn.player.photoUrl,
          age: Math.max(15, drawn.seasonYear - drawn.player.dateOfBirth.getUTCFullYear()),
          positions: drawn.positions,
          preferredFoot: drawn.preferredFoot,
          weakFoot: drawn.weakFoot,
          attributes: drawn.attributes as object,
          overall: drawn.overall,
          potential: drawn.potential,
          traits: drawn.traits,
        },
      });

      const patchedLineup = lineup.map((slot) =>
        slot.playerId === weakestSlot.playerId ? { position: slot.position, playerId: incoming.id } : slot,
      );
      await tx.worldClub.update({ where: { id: club.id }, data: { lineup: patchedLineup as object } });

      const transfer = await tx.transfer.create({
        data: {
          worldId,
          // No WorldClub exists for the source — the incoming player is drawn fresh from the ref
          // catalog, not moved from another club in this world — so this records the source
          // RefClubSeason for audit/display rather than a real WorldClub id (Transfer.fromClubId
          // has no FK constraint, same as the rest of this "Phase 2+" model group).
          fromClubId: drawn.clubSeasonId,
          toClubId: club.id,
          playerId: incoming.id,
          feeCents: 0n,
          type: "PERMANENT",
          status: "COMPLETED",
        },
      });

      return tx.januaryEvent.create({
        data: {
          worldId,
          seasonId,
          clubId: club.id,
          eventType,
          outPlayerId: weakestPlayer.id,
          outPlayerName: weakestPlayer.name,
          outOverall: weakestPlayer.overall,
          inPlayerId: incoming.id,
          inPlayerName: incoming.name,
          inOverall: incoming.overall,
          delta: incoming.overall - weakestPlayer.overall,
          transferId: transfer.id,
        },
      });
    });

    return {
      eventType: event.eventType,
      outPlayer: {
        id: event.outPlayerId,
        name: event.outPlayerName,
        overall: event.outOverall,
        position: weakestSlot.position,
      },
      inPlayer: {
        id: event.inPlayerId,
        name: event.inPlayerName,
        overall: event.inOverall,
        position: drawn.positions[0] ?? weakestSlot.position,
        clubName: drawn.clubSeason.club.name,
        seasonYear: drawn.seasonYear,
      },
      delta: event.delta,
    };
  }
}
