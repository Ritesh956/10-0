import { BadRequestException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import type { Lineup } from "./lineup.js";

export interface InstantiateWorldClubArgs {
  worldId: string;
  name: string;
  /** null/undefined for a fantasy-draft club with no single source club-season. */
  refClubSeasonId?: string | undefined;
  /** null = AI-controlled. */
  managedByUserId?: string | undefined;
  formation: string;
  lineup: Lineup;
  allPlayerSeasonIds: string[];
}

/**
 * Copy-on-write: instantiates a WorldClub plus its WorldPlayers from a set of
 * RefPlayerSeason rows, snapshotting their attributes into the world/save so
 * the world can evolve independently of the reference catalog.
 */
export async function instantiateWorldClub(prisma: PrismaClient, args: InstantiateWorldClubArgs) {
  const playerSeasons = await prisma.refPlayerSeason.findMany({
    where: { id: { in: args.allPlayerSeasonIds } },
    include: { player: true },
  });
  const byId = new Map(playerSeasons.map((ps) => [ps.id, ps]));

  return prisma.$transaction(async (tx) => {
    const club = await tx.worldClub.create({
      data: {
        worldId: args.worldId,
        refClubSeasonId: args.refClubSeasonId ?? null,
        name: args.name,
        managedByUserId: args.managedByUserId ?? null,
        formation: args.formation,
        lineup: [],
        bench: [],
      },
    });

    // WorldPlayer rows get their own generated ids, distinct from the
    // RefPlayerSeason ids in `args.lineup` — the stored lineup/bench JSON
    // must reference those new ids, not the reference-catalog ones.
    const refToWorldPlayerId = new Map<string, string>();

    for (const slot of [...args.lineup.starters, ...args.lineup.bench]) {
      const ps = byId.get(slot.refPlayerSeasonId);
      if (!ps) throw new BadRequestException(`Missing player season ${slot.refPlayerSeasonId}`);
      const worldPlayer = await tx.worldPlayer.create({
        data: {
          worldId: args.worldId,
          clubId: club.id,
          refPlayerSeasonId: ps.id,
          name: ps.player.name,
          age: Math.max(15, ps.seasonYear - ps.player.dateOfBirth.getUTCFullYear()),
          positions: ps.positions,
          preferredFoot: ps.preferredFoot,
          weakFoot: ps.weakFoot,
          attributes: ps.attributes as object,
          overall: ps.overall,
          potential: ps.potential,
          traits: ps.traits,
        },
      });
      refToWorldPlayerId.set(slot.refPlayerSeasonId, worldPlayer.id);
    }

    const toSlot = (s: { position: string; refPlayerSeasonId: string }) => ({
      position: s.position,
      playerId: refToWorldPlayerId.get(s.refPlayerSeasonId),
    });

    return tx.worldClub.update({
      where: { id: club.id },
      data: {
        lineup: args.lineup.starters.map(toSlot) as object,
        bench: args.lineup.bench.map(toSlot) as object,
      },
    });
  });
}
