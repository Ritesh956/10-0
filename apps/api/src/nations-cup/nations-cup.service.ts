import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { buildStandings, type CompletedResult, type Position } from "@futbol/domain";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { AI_CLUB_FORMATION, REAL_LEAGUE_COUNTRIES, SeasonsService } from "../seasons/seasons.service.js";
import { EuropeService } from "../europe/europe.service.js";
import { pairClubs, type RankedClub } from "../europe/european-format.js";
import { buildLineup, type DraftCandidate } from "../common/lineup.js";
import { instantiateWorldClub } from "../common/instantiate-world-club.js";
import {
  drawGroups,
  GROUP_LETTERS,
  groupFixtures,
  groupsFromFixtures,
  NATIONS_COUNT,
  quarterFinalPairs,
  seedNations,
  type GroupResult,
  type NationEntrant,
} from "./nations-cup.logic.js";

export const NATIONS_CUP_NAME = "Nations Cup";
/** A nation needs this many players in the catalog before it can field a squad. */
const MIN_SQUAD_POOL = 16;

function strengthOf(overalls: number[]): number {
  const best = [...overalls].sort((a, b) => b - a).slice(0, 11);
  return best.length === 0 ? 0 : best.reduce((s, o) => s + o, 0) / best.length;
}

interface BestSeasonRow {
  id: string;
  nationality: string;
  overall: number;
  positions: string[];
}

/**
 * The Nations Cup (38-0's "Nations Trophy" as a real tournament): after a season, take your XI to a
 * 16-side tournament against 15 national teams built from the best players of each nationality in
 * the five-league catalog (each player at their career-best season). Four groups of four, then
 * single-leg quarter-finals, semi-finals and a Final — all simulated by the ordinary worker.
 * Knockout rounds reuse EuropeService's round machinery (single-leg), so the bracket logic is shared.
 */
@Injectable()
export class NationsCupService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
    @Inject(SeasonsService) private readonly seasons: SeasonsService,
    @Inject(EuropeService) private readonly europe: EuropeService,
  ) {}

  private cup(worldId: string) {
    return this.prisma.competition.findFirst({ where: { worldId, type: "INTERNATIONAL", name: NATIONS_CUP_NAME } });
  }

  async getStatus(worldId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const competition = await this.cup(worldId);
    if (!competition) return { started: false as const };
    const first = await this.prisma.season.findFirst({ where: { worldId, competitionId: competition.id }, orderBy: { createdAt: "asc" } });
    const ties = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId: competition.id } });
    const final = ties.find((t) => t.round === "FINAL" && t.winnerClubId);
    return {
      started: true as const,
      competitionId: competition.id,
      groupSeasonId: first?.id ?? null,
      champion: final?.winnerClubId ?? null,
    };
  }

  /** Builds the field, draws the groups and queues the group stage. Idempotent per world. */
  async start(worldId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);
    const userClub = world.clubs.find((c) => c.managedByUserId === userId);
    if (!userClub) throw new BadRequestException("You don't manage a club in this world");

    const existing = await this.cup(worldId);
    if (existing) {
      const first = await this.prisma.season.findFirst({ where: { worldId, competitionId: existing.id }, orderBy: { createdAt: "asc" } });
      if (first) return { competitionId: existing.id, seasonId: first.id, groups: await this.groupTables(worldId, first.id) };
    }

    const settings = (world.settings as { nationsNationality?: string } | null) ?? {};
    const nations = await this.selectNations(world.eraId, settings.nationsNationality);
    const aiClubIds = await this.instantiateNations(worldId, nations);

    const entrants = await this.entrants(worldId, [userClub.id, ...aiClubIds]);
    const seeded = seedNations(entrants);
    const groups = drawGroups(seeded, randomInt(2 ** 31));
    const fixtures = groupFixtures(groups);

    const competition = await this.prisma.competition.create({
      data: { worldId, name: NATIONS_CUP_NAME, type: "INTERNATIONAL" },
    });
    const season = await this.prisma.season.create({
      data: { worldId, competitionId: competition.id, year: new Date().getFullYear(), status: "SCHEDULED" },
    });
    await this.prisma.fixture.createMany({
      data: fixtures.map((f) => ({
        worldId,
        seasonId: season.id,
        matchday: f.matchday,
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        status: "SCHEDULED" as const,
      })),
    });
    await this.seasons.requestSimulation(worldId, season.id, userId);
    return { competitionId: competition.id, seasonId: season.id, groups: await this.groupTables(worldId, season.id) };
  }

  /** The four group tables, from the group stage's fixtures and results. */
  async getGroups(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    return this.groupTables(worldId, seasonId);
  }

  /** Quarter-finals from the finished groups: winners meet the other half's runners-up. */
  async startKnockouts(worldId: string, competitionId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const first = await this.prisma.season.findFirst({ where: { worldId, competitionId }, orderBy: { createdAt: "asc" } });
    if (!first) throw new NotFoundException("No group stage for this competition");
    if (first.status !== "COMPLETED") throw new BadRequestException("The group stage isn't finished yet");

    const groups = await this.groupTables(worldId, first.id);
    const results: GroupResult[] = groups.map((g) => ({ winner: g.rows[0]!.clubId, runnerUp: g.rows[1]!.clubId }));

    const clubIds = groups.flatMap((g) => g.rows.map((r) => r.clubId));
    const seeded = seedNations(await this.entrants(worldId, clubIds));
    const rank = new Map(seeded.map((s) => [s.clubId, s.seed]));
    const ranked = (clubId: string): RankedClub => ({ clubId, rank: rank.get(clubId) ?? 99 });
    const pairs = quarterFinalPairs(results).map(([a, b]) => pairClubs(ranked(a), ranked(b)));
    return this.europe.createRound(worldId, competitionId, "QF", pairs, userId, { singleLeg: true });
  }

  // ---- internals ------------------------------------------------------------------------------

  private async groupTables(worldId: string, seasonId: string) {
    const fixtures = await this.prisma.fixture.findMany({
      where: { worldId, seasonId },
      include: { match: { select: { homeScore: true, awayScore: true } } },
    });
    const groups = groupsFromFixtures(fixtures);
    return groups.slice(0, GROUP_LETTERS.length).map((clubIds, i) => {
      const set = new Set(clubIds);
      const results: CompletedResult[] = fixtures
        .filter((f): f is typeof f & { match: NonNullable<(typeof f)["match"]> } => f.match !== null && set.has(f.homeClubId))
        .map((f) => ({
          homeClubId: f.homeClubId,
          awayClubId: f.awayClubId,
          homeScore: f.match.homeScore,
          awayScore: f.match.awayScore,
        }));
      return { letter: GROUP_LETTERS[i]!, rows: buildStandings(seasonId, clubIds, results).rows };
    });
  }

  /** The 15 strongest nations by their best eleven, never the user's own nation in a nations-locked run. */
  private async selectNations(eraId: string, excludeNationality: string | undefined) {
    const rows = await this.prisma.$queryRaw<BestSeasonRow[]>`
      SELECT DISTINCT ON (ps."playerId") ps.id, p.nationality, ps.overall, ps.positions
      FROM ref_player_seasons ps
      JOIN ref_players p ON p.id = ps."playerId"
      JOIN ref_club_seasons cs ON cs.id = ps."clubSeasonId"
      JOIN ref_leagues l ON l.id = cs."leagueId"
      WHERE l.country = ANY(${REAL_LEAGUE_COUNTRIES}) AND l."eraId" = ${eraId}
      ORDER BY ps."playerId", ps.overall DESC`;
    const byNation = new Map<string, BestSeasonRow[]>();
    for (const r of rows) byNation.set(r.nationality, [...(byNation.get(r.nationality) ?? []), r]);
    const nations = [...byNation.entries()]
      .filter(([nation, players]) => players.length >= MIN_SQUAD_POOL && nation !== excludeNationality)
      .map(([nation, players]) => ({ nation, players, strength: strengthOf(players.map((p) => p.overall)) }))
      .sort((a, b) => b.strength - a.strength || a.nation.localeCompare(b.nation))
      .slice(0, NATIONS_COUNT - 1);
    if (nations.length < NATIONS_COUNT - 1) throw new BadRequestException("Not enough nations in the catalog for a Nations Cup");
    return nations;
  }

  private async instantiateNations(worldId: string, nations: { nation: string; players: BestSeasonRow[] }[]): Promise<string[]> {
    const managerIds = (await this.prisma.refManager.findMany({ select: { id: true } })).map((m) => m.id);
    const created: string[] = [];
    for (let i = 0; i < nations.length; i += 8) {
      const batch = await Promise.all(
        nations.slice(i, i + 8).map(({ nation, players }) => {
          const pool: DraftCandidate[] = players.map((p) => ({
            refPlayerSeasonId: p.id,
            positions: p.positions as Position[],
            overall: p.overall,
          }));
          const lineup = buildLineup(AI_CLUB_FORMATION, pool);
          return instantiateWorldClub(this.prisma, {
            worldId,
            name: nation,
            refClubSeasonId: undefined,
            managedByUserId: undefined,
            formation: AI_CLUB_FORMATION,
            lineup,
            allPlayerSeasonIds: [...lineup.starters, ...lineup.bench].map((s) => s.refPlayerSeasonId),
            refManagerId: managerIds.length > 0 ? managerIds[randomInt(managerIds.length)] : undefined,
          });
        }),
      );
      created.push(...batch.map((c) => c.id));
    }
    return created;
  }

  private async entrants(worldId: string, clubIds: string[]): Promise<NationEntrant[]> {
    const players = await this.prisma.worldPlayer.findMany({ where: { worldId, clubId: { in: clubIds } }, select: { clubId: true, overall: true } });
    const byClub = new Map<string, number[]>();
    for (const p of players) byClub.set(p.clubId, [...(byClub.get(p.clubId) ?? []), p.overall]);
    return clubIds.map((clubId) => ({ clubId, strength: strengthOf(byClub.get(clubId) ?? []) }));
  }
}
