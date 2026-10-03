import { randomInt } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { PRISMA } from "../prisma/prisma.module.js";
import type { ClubSeasonFilterDto, PlayerSeasonFilterDto } from "./catalog.schemas.js";
import { BEST_XI_SLOTS, pickBestXi, type BestXiCandidate, type BestXiSlot } from "./best-xi.logic.js";

/** Mirrors apps/web/src/lib/leagues.ts's REAL_LEAGUE_COUNTRIES (and seasons.service.ts's own copy)
    — the real top-5 dataset shares an era with the fictional placeholder one, so anything listing
    "real" clubs/leagues needs this same filter. Kept as each file's own small copy per the existing
    convention rather than a shared util, since it's five string literals. */
const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

@Injectable()
export class CatalogService {
  /** The reference catalog only changes on a reseed (which restarts nothing, but is rare), so each
      league's Best XI is computed once per process. */
  private readonly bestXiCache = new Map<string, Promise<BestXiSlot[]>>();

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** A league's top-rated XI across every season we have, with alternatives per slot (pickBestXi). */
  getBestXi(leagueId: string): Promise<BestXiSlot[]> {
    let cached = this.bestXiCache.get(leagueId);
    if (!cached) {
      cached = this.loadBestXi(leagueId);
      this.bestXiCache.set(leagueId, cached);
      cached.catch(() => this.bestXiCache.delete(leagueId));
    }
    return cached;
  }

  private async loadBestXi(leagueId: string): Promise<BestXiSlot[]> {
    const league = await this.prisma.refLeague.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException("League not found");
    const positions = [...new Set(BEST_XI_SLOTS.flatMap((s) => s.positions))];
    // Top 40 rows per primary position (a player can appear once per season, so this leaves
    // plenty of distinct players for two centre-backs plus three alternatives each).
    const rows = await this.prisma.$queryRaw<BestXiCandidate[]>`
      SELECT "playerSeasonId", "playerId", name, nationality, "photoUrl", "clubName", "seasonYear", overall, position
      FROM (
        SELECT rps.id AS "playerSeasonId", rps."playerId", p.name, p.nationality, p."photoUrl",
               c.name AS "clubName", rps."seasonYear", rps.overall, rps.positions[1] AS position,
               ROW_NUMBER() OVER (PARTITION BY rps.positions[1] ORDER BY rps.overall DESC, rps."seasonYear" DESC) AS rn
        FROM ref_player_seasons rps
        JOIN ref_club_seasons cs ON cs.id = rps."clubSeasonId"
        JOIN ref_clubs c ON c.id = cs."clubId"
        JOIN ref_players p ON p.id = rps."playerId"
        WHERE cs."leagueId" = ${leagueId} AND rps.positions[1] = ANY(${positions})
      ) ranked
      WHERE rn <= 40`;
    return pickBestXi(rows);
  }

  listEras() {
    return this.prisma.era.findMany({ orderBy: { startYear: "asc" } });
  }

  /** Each league carries the season span it actually has data for, so the web era slider and the
      landing page's archive stats reflect the real catalog instead of the era's nominal range (the
      all-time era is 1992–2025 nominally, but the real top-5 data only covers 2012–2024). */
  async listLeagues(eraId?: string) {
    const [leagues, spans] = await Promise.all([
      this.prisma.refLeague.findMany({
        ...(eraId ? { where: { eraId } } : {}),
        orderBy: { name: "asc" },
      }),
      this.prisma.refClubSeason.groupBy({
        by: ["leagueId"],
        _min: { seasonYear: true },
        _max: { seasonYear: true },
      }),
    ]);
    const spanByLeague = new Map(spans.map((s) => [s.leagueId, s]));
    return leagues.map((league) => ({
      ...league,
      minSeasonYear: spanByLeague.get(league.id)?._min.seasonYear ?? null,
      maxSeasonYear: spanByLeague.get(league.id)?._max.seasonYear ?? null,
    }));
  }

  listClubSeasons(filter: ClubSeasonFilterDto) {
    return this.prisma.refClubSeason.findMany({
      where: {
        ...(filter.clubId ? { clubId: filter.clubId } : {}),
        ...(filter.nationality ? { playerSeasons: { some: { player: { nationality: filter.nationality } } } } : {}),
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
   * Distinct nationalities represented across the top-5 catalog, each with a count of distinct
   * real players (not player-seasons) — powers the Nations Trophy directory (Phase 10), the
   * nationality-locked analogue of listClubs(). Grouped in SQL via Prisma's groupBy rather than
   * flattened in JS (unlike getClubPositionCoverage) since RefPlayer.nationality is a scalar
   * column, not an array, so a real groupBy is both available and cheaper than a full table scan.
   */
  async listNations() {
    const rows = await this.prisma.refPlayer.groupBy({
      by: ["nationality"],
      where: {
        playerSeasons: { some: { clubSeason: { league: { country: { in: REAL_LEAGUE_COUNTRIES } } } } },
      },
      _count: { _all: true },
      orderBy: { nationality: "asc" },
    });
    return rows
      .map((r) => ({ nationality: r.nationality, playerCount: r._count._all }))
      .sort((a, b) => b.playerCount - a.playerCount);
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
        ...(filter.nationality ? { player: { nationality: filter.nationality } } : {}),
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
