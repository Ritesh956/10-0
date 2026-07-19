import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@futbol/db";
import { buildStandings, type CompletedResult } from "@futbol/domain";
import { PRISMA } from "../prisma/prisma.module.js";
import { WorldsService } from "../worlds/worlds.service.js";
import { SeasonsService } from "../seasons/seasons.service.js";
import { generateSingleRoundRobin } from "../seasons/round-robin.js";

/**
 * The world is a single 20-club league (not several real leagues feeding a 36-team UCL), so this
 * is a deliberately scaled-down adaptation: top 8 league finishers qualify, a single round-robin
 * "league phase" seeds an 8-team knockout bracket (QF -> SF -> Final), two legs per tie except the
 * single-match Final. No Round of 16 — with only 8 qualifiers there's nothing to round down from.
 */
const QUALIFIER_COUNT = 8;
const ROUND_ORDER = ["QF", "SF", "FINAL"] as const;
type KnockoutRoundName = (typeof ROUND_ORDER)[number];

interface Seed {
  clubId: string;
  rank: number;
}

@Injectable()
export class EuropeService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(WorldsService) private readonly worlds: WorldsService,
    @Inject(SeasonsService) private readonly seasons: SeasonsService,
  ) {}

  async getStatus(worldId: string, domesticSeasonId: string, userId: string) {
    const world = await this.worlds.getWorld(worldId, userId);
    const standings = await this.seasons.getStandings(worldId, domesticSeasonId, userId);
    const userClub = world.clubs.find((c) => c.managedByUserId === userId);
    const position = userClub ? standings.rows.findIndex((r) => r.clubId === userClub.id) + 1 : 0;
    const qualified = position > 0 && position <= QUALIFIER_COUNT;

    const competition = await this.prisma.competition.findFirst({
      where: { worldId, type: "CONTINENTAL" },
    });
    const ties = competition
      ? await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId: competition.id } })
      : [];

    return {
      qualified,
      position,
      qualifierCount: QUALIFIER_COUNT,
      competitionId: competition?.id,
      ties,
    };
  }

  /** Creates the Champions League competition and its league-phase season/fixtures among the top 8. */
  async startLeaguePhase(worldId: string, domesticSeasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const standings = await this.seasons.getStandings(worldId, domesticSeasonId, userId);
    const qualifiedClubIds = standings.rows.slice(0, QUALIFIER_COUNT).map((r) => r.clubId);
    if (qualifiedClubIds.length < 2) {
      throw new BadRequestException("Not enough qualified clubs to run a European competition");
    }

    const competition = await this.prisma.competition.create({
      data: { worldId, name: "Champions League", type: "CONTINENTAL" },
    });
    const season = await this.prisma.season.create({
      data: { worldId, competitionId: competition.id, year: new Date().getFullYear(), status: "SCHEDULED" },
    });

    const fixtures = generateSingleRoundRobin(qualifiedClubIds);
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
    return { competitionId: competition.id, seasonId: season.id };
  }

  /** Starts the QF round from the completed league-phase season's standings (1v8, 2v7, 3v6, 4v5). */
  async startKnockouts(worldId: string, competitionId: string, leaguePhaseSeasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const seeds = await this.seedsForSeason(worldId, leaguePhaseSeasonId);
    if (seeds.length < QUALIFIER_COUNT) {
      throw new BadRequestException("League phase hasn't produced enough clubs for a knockout bracket");
    }

    const pairs: [Seed, Seed][] = [
      [seeds[0]!, seeds[7]!],
      [seeds[1]!, seeds[6]!],
      [seeds[2]!, seeds[5]!],
      [seeds[3]!, seeds[4]!],
    ];
    return this.createRound(worldId, competitionId, "QF", pairs, userId);
  }

  /**
   * Resolves the given round's ties (by aggregate, penalties if level) and, unless this was the
   * Final, creates the next round on top. The caller gets both the just-decided ties (to show a
   * winner announcement) and the next round to simulate/reveal — kept separate rather than merged
   * into one ambiguous "ties" array.
   */
  async advanceKnockouts(worldId: string, competitionId: string, round: KnockoutRoundName, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    const ties = await this.prisma.knockoutTie.findMany({ where: { worldId, competitionId, round } });
    if (ties.length === 0) throw new NotFoundException(`No ${round} ties found for this competition`);

    const resolvedTies = await Promise.all(ties.map((tie) => this.resolveTie(tie)));

    if (round === "FINAL") {
      return { resolvedRound: round, resolvedTies, champion: resolvedTies[0]?.winnerClubId };
    }

    const nextRound = ROUND_ORDER[ROUND_ORDER.indexOf(round) + 1]!;
    const winners = resolvedTies.map((tie) => tie.winnerClubId!);
    // Bracket order: tie0-winner vs tie3-winner, tie1-winner vs tie2-winner — keeps the top seeds
    // apart for as long as possible, same convention as a standard single-elimination draw.
    const pairIndexes: [number, number][] = winners.length === 4 ? [[0, 3], [1, 2]] : [[0, 1]];
    const seedByClub = new Map((await this.seedsForCompetition(worldId, competitionId)).map((s) => [s.clubId, s.rank]));
    const pairs: [Seed, Seed][] = pairIndexes.map(([i, j]) => {
      const a = { clubId: winners[i]!, rank: seedByClub.get(winners[i]!) ?? 99 };
      const b = { clubId: winners[j]!, rank: seedByClub.get(winners[j]!) ?? 99 };
      return a.rank <= b.rank ? [a, b] : [b, a];
    });

    const next = await this.createRound(worldId, competitionId, nextRound, pairs, userId);
    return { resolvedRound: round, resolvedTies, next };
  }

  async getBracket(worldId: string, competitionId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    return this.prisma.knockoutTie.findMany({ where: { worldId, competitionId }, orderBy: { round: "asc" } });
  }

  /** Mini-standings for the league-phase season — same shape as the domestic table, scoped to just the 8 qualifiers. */
  async getLeaguePhaseStandings(worldId: string, seasonId: string, userId: string) {
    await this.worlds.assertOwnership(worldId, userId);
    return this.computeStandings(worldId, seasonId);
  }

  private async createRound(
    worldId: string,
    competitionId: string,
    round: KnockoutRoundName,
    pairs: [Seed, Seed][],
    userId: string,
  ) {
    const season = await this.prisma.season.create({
      data: { worldId, competitionId, year: new Date().getFullYear(), status: "SCHEDULED" },
    });

    const isFinal = round === "FINAL";
    const ties = [];
    for (const [stronger, weaker] of pairs) {
      const firstLeg = await this.prisma.fixture.create({
        data: {
          worldId,
          seasonId: season.id,
          matchday: 1,
          homeClubId: isFinal ? stronger.clubId : weaker.clubId,
          awayClubId: isFinal ? weaker.clubId : stronger.clubId,
          status: "SCHEDULED",
        },
      });
      const secondLeg = isFinal
        ? null
        : await this.prisma.fixture.create({
            data: {
              worldId,
              seasonId: season.id,
              matchday: 2,
              homeClubId: stronger.clubId,
              awayClubId: weaker.clubId,
              status: "SCHEDULED",
            },
          });

      const tie = await this.prisma.knockoutTie.create({
        data: {
          worldId,
          competitionId,
          round,
          homeClubId: stronger.clubId,
          awayClubId: weaker.clubId,
          firstLegFixtureId: firstLeg.id,
          secondLegFixtureId: secondLeg?.id ?? null,
        },
      });
      ties.push(tie);
    }

    await this.seasons.requestSimulation(worldId, season.id, userId);
    return { round, seasonId: season.id, ties };
  }

  /** Winner-take-all resolution for one tie: aggregate score, falling back to a penalty shootout if level. */
  private async resolveTie(tie: { id: string; homeClubId: string; awayClubId: string; firstLegFixtureId: string | null; secondLegFixtureId: string | null }) {
    const legIds = [tie.firstLegFixtureId, tie.secondLegFixtureId].filter((id): id is string => id !== null);
    const legs = await this.prisma.fixture.findMany({ where: { id: { in: legIds } }, include: { match: true } });

    let homeAgg = 0;
    let awayAgg = 0;
    for (const leg of legs) {
      if (!leg.match) continue;
      const homeIsTieHome = leg.homeClubId === tie.homeClubId;
      homeAgg += homeIsTieHome ? leg.match.homeScore : leg.match.awayScore;
      awayAgg += homeIsTieHome ? leg.match.awayScore : leg.match.homeScore;
    }

    let winnerClubId: string;
    let wentToPenalties = false;
    if (homeAgg !== awayAgg) {
      winnerClubId = homeAgg > awayAgg ? tie.homeClubId : tie.awayClubId;
    } else {
      wentToPenalties = true;
      winnerClubId = await this.resolvePenalties(tie.homeClubId, tie.awayClubId);
    }

    return this.prisma.knockoutTie.update({
      where: { id: tie.id },
      data: { winnerClubId, wentToPenalties },
    });
  }

  /**
   * Not a full penalty-by-penalty simulation (out of scope) — a single weighted coin flip, nudged
   * by each side's average squad quality, using the same crypto RNG pattern already used elsewhere
   * in this service layer (e.g. SeasonsService's AI manager assignment) for genuine per-call randomness.
   */
  private async resolvePenalties(homeClubId: string, awayClubId: string): Promise<string> {
    const [homeAvg, awayAvg] = await Promise.all([this.averageOverall(homeClubId), this.averageOverall(awayClubId)]);
    const diff = Math.max(-15, Math.min(15, homeAvg - awayAvg));
    const homeWinChance = 0.5 + diff / 100;
    return randomInt(10000) / 10000 < homeWinChance ? homeClubId : awayClubId;
  }

  private async averageOverall(clubId: string): Promise<number> {
    const result = await this.prisma.worldPlayer.aggregate({ where: { clubId }, _avg: { overall: true } });
    return result._avg.overall ?? 70;
  }

  /** Standings for every club that has a fixture in this season, computed from completed results. */
  private async computeStandings(worldId: string, seasonId: string) {
    const fixtures = await this.prisma.fixture.findMany({
      where: { worldId, seasonId },
      include: { match: true },
    });
    const clubIds = [...new Set(fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))];
    const results: CompletedResult[] = fixtures
      .filter((f): f is typeof f & { match: NonNullable<(typeof f)["match"]> } => f.match !== null)
      .map((f) => ({
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeScore: f.match.homeScore,
        awayScore: f.match.awayScore,
      }));
    return buildStandings(seasonId, clubIds, results);
  }

  /** Seed ranks (0 = best) for the clubs that played in a given season, from that season's results. */
  private async seedsForSeason(worldId: string, seasonId: string): Promise<Seed[]> {
    const standings = await this.computeStandings(worldId, seasonId);
    return standings.rows.map((row, rank) => ({ clubId: row.clubId, rank }));
  }

  /** Seed ranks carried forward from the league-phase season of this competition (used to reseed SF/Final). */
  private async seedsForCompetition(worldId: string, competitionId: string): Promise<Seed[]> {
    const leaguePhaseSeason = await this.prisma.season.findFirst({
      where: { worldId, competitionId },
      orderBy: { createdAt: "asc" },
    });
    if (!leaguePhaseSeason) return [];
    return this.seedsForSeason(worldId, leaguePhaseSeason.id);
  }
}
