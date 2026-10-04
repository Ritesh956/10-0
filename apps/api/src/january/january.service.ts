import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import {
  biasPoolForKind,
  drawDistinct,
  eventLabel,
  eventPremise,
  eventTypeForDelta,
  pickForeignLeague,
  pickKind,
  pickTargetSlot,
  seededRandom,
  type JanuaryEventKind,
  type JanuaryEventType,
  type JanuaryKindSpec,
  type LineupSlotJson,
} from "./january.logic.js";

/** Mirrors catalog.service.ts's copy — January signings come from the real top-5 catalog only. */
const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

interface WorldSettingsShape {
  europeanNights?: boolean;
  januaryWindow?: boolean;
  leagueId?: string;
}

export interface JanuaryOption {
  id: string;
  name: string;
  clubName: string;
  seasonYear: number;
  position: string;
}

/** GET-able preview of this season's window: which event came up and, for a choice event, the blind
    options. Ratings of incoming players are deliberately left out — they're revealed on signing. */
export interface JanuaryOffer {
  kind: JanuaryEventKind;
  label: string;
  premise: string;
  /** The other league a cross-border event reaches into (for a flag), when there is one. */
  league: { name: string; country: string } | null;
  outPlayer: { id: string; name: string; overall: number; position: string };
  options: JanuaryOption[] | null;
}

export interface JanuaryResult {
  eventType: JanuaryEventType;
  kind: JanuaryEventKind;
  label: string;
  outPlayer: { id: string; name: string; overall: number; position: string };
  inPlayer: { id: string; name: string; overall: number; position: string; clubName: string; seasonYear: number };
  delta: number;
}

/**
 * The January Transfer Window. An event kind (january.logic.ts JANUARY_KINDS) decides which lineup
 * slot is touched and how its replacement is found; everything about the offer is derived from a
 * seed of (season, club), so `getOffer` and `resolveGamble` always agree and a refresh can't re-roll
 * it — nothing is stored until the deal is done. Resolving instantiates a WorldPlayer for the
 * incoming player (same field mapping as instantiate-world-club.ts), patches that one lineup slot
 * (the slot keeps its position, so the drafted shape survives), and persists a JanuaryEvent (+ a
 * Transfer row for audit) in one transaction. `@@unique([seasonId, clubId])` on JanuaryEvent is the
 * idempotency guard: one window per club per season.
 */
@Injectable()
export class JanuaryService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
  ) {}

  async getOffer(worldId: string, seasonId: string, userId: string): Promise<JanuaryOffer> {
    const offer = await this.buildOffer(worldId, seasonId, userId);
    return {
      kind: offer.spec.kind,
      label: offer.label,
      premise: offer.premise,
      league: offer.foreignLeague,
      outPlayer: offer.outPlayer,
      options: offer.options?.map((o) => ({
        id: o.id,
        name: o.player.name,
        clubName: o.clubSeason.club.name,
        seasonYear: o.seasonYear,
        position: offer.outPlayer.position,
      })) ?? null,
    };
  }

  async resolveGamble(worldId: string, seasonId: string, userId: string, choiceId?: string): Promise<JanuaryResult> {
    const offer = await this.buildOffer(worldId, seasonId, userId);
    const { spec, club, lineup, outSlot, outPlayer, label } = offer;

    let drawn: (typeof offer.pool)[number];
    if (offer.options) {
      const chosen = offer.options.find((o) => o.id === choiceId);
      if (!chosen) throw new BadRequestException("Pick one of the three offers");
      drawn = chosen;
    } else {
      drawn = offer.pool[Math.floor(offer.random() * offer.pool.length)]!;
    }

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
        slot.playerId === outSlot.playerId ? { position: slot.position, playerId: incoming.id } : slot,
      );
      await tx.worldClub.update({ where: { id: club.id }, data: { lineup: patchedLineup as object } });

      const transfer = await tx.transfer.create({
        data: {
          worldId,
          // No WorldClub exists for the source — the incoming player is drawn fresh from the ref
          // catalog — so this records the source RefClubSeason for audit/display (Transfer.fromClubId
          // has no FK constraint, same as the rest of this "Phase 2+" model group).
          fromClubId: drawn.clubSeasonId,
          toClubId: club.id,
          playerId: incoming.id,
          feeCents: 0n,
          type: spec.kind === "loan-swap" ? "LOAN" : "PERMANENT",
          status: "COMPLETED",
        },
      });

      const delta = incoming.overall - outPlayer.overall;
      return tx.januaryEvent.create({
        data: {
          worldId,
          seasonId,
          clubId: club.id,
          eventType: eventTypeForDelta(delta),
          outPlayerId: outPlayer.id,
          outPlayerName: outPlayer.name,
          outOverall: outPlayer.overall,
          inPlayerId: incoming.id,
          inPlayerName: incoming.name,
          inOverall: incoming.overall,
          delta,
          transferId: transfer.id,
        },
      });
    });

    return {
      eventType: event.eventType,
      kind: spec.kind,
      label,
      outPlayer,
      inPlayer: {
        id: event.inPlayerId,
        name: event.inPlayerName,
        overall: event.inOverall,
        // The slot keeps its position — show that, not the incoming player's listed one.
        position: outSlot.position,
        clubName: drawn.clubSeason.club.name,
        seasonYear: drawn.seasonYear,
      },
      delta: event.delta,
    };
  }

  /** Everything about this season's window, derived deterministically from (season, club). */
  private async buildOffer(worldId: string, seasonId: string, userId: string) {
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

    const worldPlayers = await this.prisma.worldPlayer.findMany({ where: { id: { in: lineup.map((s) => s.playerId) } } });
    const playerById = new Map(worldPlayers.map((p) => [p.id, p]));

    const seed = `${seasonId}:${club.id}`;
    const spec: JanuaryKindSpec = pickKind(seededRandom(`${seed}:kind`));
    const target = pickTargetSlot(lineup, playerById, spec.target, seededRandom(`${seed}:slot`));
    if (!target) throw new BadRequestException("Could not determine a slot to change");
    const { slot: outSlot, player: out } = target;

    // The league the season is played in: the world's stored league, else the club's source league.
    const homeLeagueId =
      settings.leagueId ??
      (club.refClubSeasonId
        ? (await this.prisma.refClubSeason.findUnique({ where: { id: club.refClubSeasonId }, select: { leagueId: true } }))?.leagueId
        : undefined);
    // Cross-border events reach into one specific other league, picked from the seed.
    let foreignLeague: { id: string; name: string; country: string } | undefined;
    if (spec.otherLeagues) {
      const leagues = await this.prisma.refLeague.findMany({
        where: { eraId: world.eraId, country: { in: REAL_LEAGUE_COUNTRIES } },
        select: { id: true, name: true, country: true },
      });
      foreignLeague = pickForeignLeague(leagues, homeLeagueId, seededRandom(`${seed}:league`));
    }
    const leagueFilter = {
      eraId: world.eraId,
      country: { in: REAL_LEAGUE_COUNTRIES },
      ...(foreignLeague
        ? { id: foreignLeague.id }
        : homeLeagueId
          ? spec.otherLeagues
            ? { id: { not: homeLeagueId } }
            : { id: homeLeagueId }
          : {}),
    };

    const basePool = await this.prisma.refPlayerSeason.findMany({
      where: {
        positions: { hasSome: [outSlot.position] },
        id: { notIn: worldPlayers.map((p) => p.refPlayerSeasonId) },
        clubSeason: { league: leagueFilter },
      },
      include: { player: true, clubSeason: { include: { club: true } } },
      orderBy: { id: "asc" }, // stable order is what makes the seeded draw reproducible
    });
    if (basePool.length === 0) throw new NotFoundException("No eligible replacement players found for that position");

    const random = seededRandom(`${seed}:draw`);
    const pool = biasPoolForKind(basePool, spec, out.overall);
    const options = spec.options ? drawDistinct(pool, spec.options, random) : null;

    return {
      spec,
      label: eventLabel(spec, foreignLeague?.name),
      premise: eventPremise(spec, foreignLeague?.name),
      foreignLeague: foreignLeague ? { name: foreignLeague.name, country: foreignLeague.country } : null,
      club,
      lineup,
      outSlot,
      outPlayer: { id: out.id, name: out.name, overall: out.overall, position: outSlot.position },
      pool,
      options,
      random,
    };
  }
}
