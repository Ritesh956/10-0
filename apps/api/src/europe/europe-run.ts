import type { PrismaClient } from "@futbol/db";
import { buildStandings, type CompletedResult } from "@futbol/domain";
import { summarizeEuropeRun, type EuropeRunSummary, type RunMatch } from "./europe.logic.js";

/** Name of the second European tier (see EuropeService); everything else CONTINENTAL is tier one. */
export const CUP_COMPETITION_NAME = "Continental Cup";

export interface EuropeRun {
  /** European Nights' Final winner, once it has been decided. */
  championClubId: string | null;
  /** The Continental Cup's Final winner, once decided. */
  cupChampionClubId: string | null;
  /** The user's European Nights campaign; null if they never played it. */
  summary: EuropeRunSummary | null;
}

/**
 * Reads a world's European competitions for the trophy evaluation and the run index: who won each
 * Final, and (for the user's club) the league-phase record and which leagues' clubs they beat.
 * Kept out of the Nest services so SeasonsService can use it without depending on EuropeService.
 */
export async function loadEuropeRun(
  prisma: PrismaClient,
  worldId: string,
  userClubId: string,
  homeCountry: string | undefined,
): Promise<EuropeRun> {
  const competitions = await prisma.competition.findMany({ where: { worldId, type: "CONTINENTAL" }, orderBy: { id: "asc" } });
  const tierOne = competitions.find((c) => c.name !== CUP_COMPETITION_NAME) ?? null;
  const cup = competitions.find((c) => c.name === CUP_COMPETITION_NAME) ?? null;

  const finalWinner = async (competitionId: string | undefined) => {
    if (!competitionId) return null;
    const tie = await prisma.knockoutTie.findFirst({ where: { worldId, competitionId, round: "FINAL", winnerClubId: { not: null } } });
    return tie?.winnerClubId ?? null;
  };
  const [championClubId, cupChampionClubId] = await Promise.all([finalWinner(tierOne?.id), finalWinner(cup?.id)]);
  if (!tierOne) return { championClubId, cupChampionClubId, summary: null };

  const seasons = await prisma.season.findMany({ where: { worldId, competitionId: tierOne.id }, orderBy: { createdAt: "asc" } });
  const leaguePhase = seasons[0];
  if (!leaguePhase) return { championClubId, cupChampionClubId, summary: null };

  const fixtures = await prisma.fixture.findMany({
    where: { worldId, seasonId: { in: seasons.map((s) => s.id) } },
    include: { match: { select: { homeScore: true, awayScore: true } } },
  });
  const played = fixtures.filter((f): f is typeof f & { match: NonNullable<(typeof f)["match"]> } => f.match !== null);

  const phaseFixtures = played.filter((f) => f.seasonId === leaguePhase.id);
  const clubIds = [...new Set(fixtures.filter((f) => f.seasonId === leaguePhase.id).flatMap((f) => [f.homeClubId, f.awayClubId]))];
  const results: CompletedResult[] = phaseFixtures.map((f) => ({
    homeClubId: f.homeClubId,
    awayClubId: f.awayClubId,
    homeScore: f.match.homeScore,
    awayScore: f.match.awayScore,
  }));
  const table = buildStandings(leaguePhase.id, clubIds, results);
  const rankIndex = table.rows.findIndex((r) => r.clubId === userClubId);
  if (rankIndex === -1) return { championClubId, cupChampionClubId, summary: null };

  const mine = (list: typeof played): RunMatch[] =>
    list
      .filter((f) => f.homeClubId === userClubId || f.awayClubId === userClubId)
      .map((f) => {
        const home = f.homeClubId === userClubId;
        return {
          opponentClubId: home ? f.awayClubId : f.homeClubId,
          goalsFor: home ? f.match.homeScore : f.match.awayScore,
          goalsAgainst: home ? f.match.awayScore : f.match.homeScore,
        };
      });

  const opponentIds = [...new Set(played.flatMap((f) => [f.homeClubId, f.awayClubId]))];
  const clubs = await prisma.worldClub.findMany({
    where: { id: { in: opponentIds }, worldId },
    select: { id: true, refClubSeason: { select: { league: { select: { country: true } } } } },
  });
  const countryById = new Map(clubs.map((c) => [c.id, c.refClubSeason?.league.country ?? homeCountry]));

  return {
    championClubId,
    cupChampionClubId,
    summary: summarizeEuropeRun({
      leaguePhaseMatches: mine(phaseFixtures),
      leaguePhaseRank: rankIndex + 1,
      knockoutMatches: mine(played.filter((f) => f.seasonId !== leaguePhase.id)),
      countryOf: (id) => countryById.get(id),
    }),
  };
}
