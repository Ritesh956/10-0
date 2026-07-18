import { z } from "zod";

export const fixtureStatus = z.enum(["scheduled", "in-progress", "completed", "postponed"]);
export type FixtureStatus = z.infer<typeof fixtureStatus>;

export const fixture = z.object({
  id: z.string(),
  worldId: z.string(),
  seasonId: z.string(),
  matchday: z.number().int().positive(),
  homeClubId: z.string(),
  awayClubId: z.string(),
  status: fixtureStatus,
  matchId: z.string().optional(),
});
export type Fixture = z.infer<typeof fixture>;

export const season = z.object({
  id: z.string(),
  worldId: z.string(),
  competitionId: z.string(),
  year: z.number().int(),
  status: z.enum(["scheduled", "in-progress", "completed"]),
});
export type Season = z.infer<typeof season>;

export const standingsRow = z.object({
  clubId: z.string(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
});
export type StandingsRow = z.infer<typeof standingsRow>;

export const standings = z.object({
  seasonId: z.string(),
  rows: z.array(standingsRow),
});
export type Standings = z.infer<typeof standings>;

function emptyRow(clubId: string): StandingsRow {
  return {
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

export interface CompletedResult {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Pure standings builder shared by web, api, and sim-worker so the table
 * shown live always matches what the server computed.
 */
export function buildStandings(
  seasonId: string,
  clubIds: string[],
  results: CompletedResult[],
): Standings {
  const rows = new Map<string, StandingsRow>(clubIds.map((id) => [id, emptyRow(id)]));

  for (const result of results) {
    const home = rows.get(result.homeClubId) ?? emptyRow(result.homeClubId);
    const away = rows.get(result.awayClubId) ?? emptyRow(result.awayClubId);

    home.played += 1;
    away.played += 1;
    home.goalsFor += result.homeScore;
    home.goalsAgainst += result.awayScore;
    away.goalsFor += result.awayScore;
    away.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (result.homeScore < result.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    rows.set(result.homeClubId, home);
    rows.set(result.awayClubId, away);
  }

  const sorted = [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  return { seasonId, rows: sorted };
}
