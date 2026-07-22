import { randomInt } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { ClubSeasonFilterDto, PlayerSeasonFilterDto } from "./catalog.schemas.js";

/** Mirrors apps/web/src/lib/leagues.ts's REAL_LEAGUE_COUNTRIES (and seasons.service.ts's own copy)
    — the real top-5 dataset shares an era with the fictional placeholder one, so anything listing
    "real" clubs/leagues needs this same filter. Kept as each file's own small copy per the existing
    convention rather than a shared util, since it's five string literals. */
const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

@Injectable()
export class CatalogService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  listEras() {
    return this.prisma.era.findMany({ orderBy: { startYear: "asc" } });
  }

  listLeagues(eraId?: string) {
    return this.prisma.refLeague.findMany({
      ...(eraId ? { where: { eraId } } : {}),
      orderBy: { name: "asc" },
    });
  }

  listClubSeasons(filter: ClubSeasonFilterDto) {
    return this.prisma.refClubSeason.findMany({
      where: {
        ...(filter.clubId ? { clubId: filter.clubId } : {}),
        league: {
          ...(filter.eraId ? { eraId: filter.eraId } : {}),
          ...(filter.leagueIds?.length ? { id: { in: filter.leagueIds } } : {}),
        },
      },
      include: { club: true, league: true },
      orderBy: { reputation: "desc" },
    });
  }

  /**
   * Distinct real clubs across the top-5 leagues, one row per club at its most recent season —
   * powers the One-Club XI directory (Phase 7). "Most recent" doubles as the club's "current"
   * league for AI-fill (same convention as SeasonsService.fillAiClubsFromLeague), so a One-Club
   * draft's season creation can reuse the existing leagueId-based AI-fill path unchanged.
   */
  async listClubs() {
    const clubSeasons = await this.prisma.refClubSeason.findMany({
      where: { league: { country: { in: REAL_LEAGUE_COUNTRIES } } },
      include: { club: true, league: true },
      orderBy: { seasonYear: "desc" },
    });
    const latestByClub = new Map<string, (typeof clubSeasons)[number]>();
    for (const cs of clubSeasons) {
      if (!latestByClub.has(cs.clubId)) latestByClub.set(cs.clubId, cs);
    }
    return [...latestByClub.values()]
      .map((cs) => ({
        id: cs.club.id,
        name: cs.club.name,
        country: cs.club.country,
        badgeRef: cs.club.badgeRef,
        currentLeagueId: cs.league.id,
        currentLeagueName: cs.league.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * The distinct set of positions any RefPlayerSeason has ever recorded for this club, across its
   * whole history — a cheap feasibility check for "can this formation actually be filled from this
   * club's real history" (Phase 7's One-Club draft), without a full per-slot bipartite matching.
   * Flattened in JS rather than SQL since Postgres has no simple "distinct array element" query and
   * a real club's full history is at most a few hundred rows.
   */
  async getClubPositionCoverage(clubId: string, eraId?: string): Promise<string[]> {
    const rows = await this.prisma.refPlayerSeason.findMany({
      where: { clubSeason: { clubId, ...(eraId ? { league: { eraId } } : {}) } },
      select: { positions: true },
    });
    const positions = new Set<string>();
    for (const row of rows) for (const p of row.positions) positions.add(p);
    return [...positions];
  }

  async listPlayerSeasons(filter: PlayerSeasonFilterDto) {
    const rows = await this.prisma.refPlayerSeason.findMany({
      where: {
        ...(filter.clubSeasonId ? { clubSeasonId: filter.clubSeasonId } : {}),
        ...(filter.positions?.length ? { positions: { hasSome: filter.positions } } : {}),
        clubSeason: {
          league: {
            ...(filter.eraId ? { eraId: filter.eraId } : {}),
            ...(filter.leagueIds?.length ? { id: { in: filter.leagueIds } } : {}),
          },
        },
      },
      include: { player: true, clubSeason: { include: { club: true } } },
      orderBy: { overall: "desc" },
    });

    if (filter.ratingsMode !== "prime") return rows;
    return this.substitutePeakSeasons(rows);
  }

  /**
   * "Prime" mode: swap in each player's career-best (highest-overall) season's
   * rating/attributes/positions, while keeping the drawn club-season as display
   * context — the wheel still "found" them at that club, but you draft the peak
   * version of who they are. Player identity fields (name/nationality/photo) are
   * unaffected since those live on RefPlayer, not RefPlayerSeason.
   */
  private async substitutePeakSeasons<T extends { playerId: string }>(rows: T[]): Promise<T[]> {
    const playerIds = [...new Set(rows.map((r) => r.playerId))];
    const allSeasons = await this.prisma.refPlayerSeason.findMany({
      where: { playerId: { in: playerIds } },
      orderBy: { overall: "desc" },
    });
    const peakByPlayer = new Map<string, (typeof allSeasons)[number]>();
    for (const season of allSeasons) {
      if (!peakByPlayer.has(season.playerId)) peakByPlayer.set(season.playerId, season);
    }

    return rows.map((row) => {
      const peak = peakByPlayer.get(row.playerId);
      if (!peak) return row;
      return {
        ...row,
        id: peak.id,
        positions: peak.positions,
        preferredFoot: peak.preferredFoot,
        weakFoot: peak.weakFoot,
        attributes: peak.attributes,
        overall: peak.overall,
        potential: peak.potential,
        traits: peak.traits,
      };
    });
  }

  /** A "roll" is a genuine random spin for UX flavor — unrelated to (and never used by) the deterministic match engine's seeded RNG. */
  async rollClubSeason(filter: ClubSeasonFilterDto) {
    const pool = await this.listClubSeasons(filter);
    if (pool.length === 0) throw new NotFoundException("No club seasons match those filters");
    return pool[randomInt(pool.length)];
  }

  listManagers() {
    return this.prisma.refManager.findMany({ orderBy: { name: "asc" } });
  }

  /** Same genuine-random-for-UX-flavor pattern as rollClubSeason. */
  async rollManager() {
    const pool = await this.listManagers();
    if (pool.length === 0) throw new NotFoundException("No managers available");
    return pool[randomInt(pool.length)];
  }
}
