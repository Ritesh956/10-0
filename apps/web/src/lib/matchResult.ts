import type { MatchGoalDto, MatchSummaryDto } from "../api/types";

export type MatchResult = "W" | "D" | "L";

export interface MatchForClub {
  match: MatchSummaryDto;
  isHome: boolean;
  opponentId: string;
  yourScore: number;
  theirScore: number;
  result: MatchResult;
  /** This club's own goals only, sorted by minute — every "your results" view (MatchLog, the
      live season reveal, share cards) shows just your own scorers, not the opponent's. */
  yourGoals: MatchGoalDto[];
}

/** Reframes a match from one club's perspective — win/draw/loss, opponent, and that club's own
    goalscorers. Shared by every screen that renders "your results" so the W/D/L and goal-filtering
    logic doesn't drift between them. */
export function summarizeForClub(match: MatchSummaryDto, clubId: string): MatchForClub {
  const isHome = match.homeClubId === clubId;
  const opponentId = isHome ? match.awayClubId : match.homeClubId;
  const yourScore = isHome ? match.homeScore : match.awayScore;
  const theirScore = isHome ? match.awayScore : match.homeScore;
  const result: MatchResult = yourScore > theirScore ? "W" : yourScore < theirScore ? "L" : "D";
  const yourGoals = match.goals.filter((g) => g.clubId === clubId).sort((a, b) => a.minute - b.minute);
  return { match, isHome, opponentId, yourScore, theirScore, result, yourGoals };
}

export interface ClubRecord {
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** Cumulative W/D/L/Pts/GF/GA for one club across a set of matches — used to drive a running
    stat strip as matches reveal one by one, not just a final post-season total. */
export function accumulateRecord(matches: MatchSummaryDto[], clubId: string): ClubRecord {
  const record: ClubRecord = { won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const match of matches) {
    const { result, yourScore, theirScore } = summarizeForClub(match, clubId);
    record.goalsFor += yourScore;
    record.goalsAgainst += theirScore;
    if (result === "W") {
      record.won++;
      record.points += 3;
    } else if (result === "D") {
      record.drawn++;
      record.points += 1;
    } else {
      record.lost++;
    }
  }
  return record;
}
