export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string;
  isGuest: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface EraDto {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
}

export interface LeagueDto {
  id: string;
  eraId: string;
  name: string;
  country: string;
  tier: number;
}

export interface ClubSeasonDto {
  id: string;
  clubId: string;
  seasonYear: number;
  leagueId: string;
  reputation: number;
  club: { id: string; name: string; country: string };
  league: { id: string; name: string };
}

export interface PlayerSeasonDto {
  id: string;
  playerId: string;
  clubSeasonId: string;
  seasonYear: number;
  positions: string[];
  overall: number;
  potential: number;
  player: { name: string; nationality: string; photoUrl: string | null };
  clubSeason: { club: { name: string } };
}

export interface ManagerDto {
  id: string;
  name: string;
  nationality: string;
  philosophy: string | null;
  mentality: string;
  tempo: string;
  width: string;
  pressing: string;
  passingStyle: string;
  managerPhilosophy: string | null;
}

export interface WorldClubDto {
  id: string;
  name: string;
  managedByUserId: string | null;
  refClubSeasonId: string | null;
}

export interface WorldSettingsDto {
  europeanNights: boolean;
  januaryWindow: boolean;
  /** Phase 7 (One-Club XI) — the RefClub this world's draft was locked to, or undefined for a
      normal fantasy-XI world. Read-only from the frontend's perspective (set once at world
      creation); the backend derives leaderboard mode/refClubId from this, never from a submission
      body — see LeaderboardService.submitRun. */
  oneClubClubId?: string;
}

export interface WorldDto {
  id: string;
  ownerId: string;
  eraId: string;
  type: string;
  status: string;
  clubs: WorldClubDto[];
  settings: WorldSettingsDto | null;
}

export interface FixtureDto {
  id: string;
  matchday: number;
  homeClubId: string;
  awayClubId: string;
  status: string;
  matchId: string | null;
}

export interface SeasonDto {
  id: string;
  worldId: string;
  competitionId: string;
  year: number;
  status: string;
  fixtures: FixtureDto[];
}

export interface StandingsRowDto {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface StandingsDto {
  seasonId: string;
  rows: StandingsRowDto[];
}

export interface SquadPositionOverallDto {
  position: string;
  overall: number;
}

export interface SummaryDto {
  standings: StandingsDto;
  userClub?: { id: string; name: string };
  userRow?: StandingsRowDto;
  position?: number;
  unbeaten: boolean;
  shareText?: string;
  /** The user's starting-XI position/overall snapshot, for the season-narrative engine's per-unit
      tiering (Attack/Midfield/Defence/Goalkeeping) — grouped client-side via lib/formations.ts's
      POSITION_GROUP, same as DraftPage's squad-ratings panel. Undefined for a manager-less/AI world. */
  squad?: SquadPositionOverallDto[];
  squadOverall?: number;
}

export interface CatalogFilter {
  eraId?: string;
  leagueIds?: string[];
  positions?: string[];
  clubSeasonId?: string;
  ratingsMode?: "season" | "prime";
  /** One-Club mode (Phase 7): scopes a club-season pool fetch to a single real club's whole
      history instead of a league. */
  clubId?: string;
}

/** A distinct real club (Phase 7's One-Club directory), one row per club at its most recent
    season — currentLeagueId/-Name double as the "AI-fill this league" scope for createSeason,
    same convention as the normal per-league draft flow. */
export interface RealClubDto {
  id: string;
  name: string;
  country: string;
  badgeRef: string | null;
  currentLeagueId: string;
  currentLeagueName: string;
}

export interface MatchGoalDto {
  minute: number;
  clubId: string;
  scorerName: string;
  assistName?: string;
}

export interface MatchSummaryDto {
  fixtureId: string;
  matchday: number;
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  goals: MatchGoalDto[];
}

export interface SquadStatRowDto {
  playerId: string;
  name: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
}

export interface TeamStatsDto {
  clubId: string;
  goalsFor: number;
  goalsAgainst: number;
  topScorer?: SquadStatRowDto;
  topAssist?: SquadStatRowDto;
  squad: SquadStatRowDto[];
}

export interface CompetitionScorerRowDto {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  goals: number;
  assists: number;
  matchesPlayed: number;
  avgRating: number;
}

export interface CompetitionGoalkeeperRowDto extends CompetitionScorerRowDto {
  cleanSheets: number;
}

export interface CompetitionStatsDto {
  topScorers: CompetitionScorerRowDto[];
  goldenBoot?: CompetitionScorerRowDto;
  mvp?: CompetitionScorerRowDto;
  playmaker?: CompetitionScorerRowDto;
  goldenGlove?: CompetitionGoalkeeperRowDto;
}

export interface ManagerStatsDto {
  manager: { name: string; nationality: string; philosophy: string | null } | null;
  cleanSheets: number;
  longestWinStreak: number;
  biggestWin?: { opponentClubId: string; ourScore: number; theirScore: number; margin: number };
  highestScoringMatch?: { opponentClubId: string; ourScore: number; theirScore: number; total: number };
}

export type KnockoutRound = "QF" | "SF" | "FINAL";

export interface KnockoutTieDto {
  id: string;
  round: KnockoutRound;
  homeClubId: string;
  awayClubId: string;
  firstLegFixtureId: string | null;
  secondLegFixtureId: string | null;
  winnerClubId: string | null;
  wentToPenalties: boolean;
}

export interface EuropeStatusDto {
  qualified: boolean;
  position: number;
  qualifierCount: number;
  competitionId?: string;
  ties: KnockoutTieDto[];
}

export interface EuropeLeaguePhaseDto {
  competitionId: string;
  seasonId: string;
}

export interface EuropeRoundDto {
  round: KnockoutRound;
  seasonId: string;
  ties: KnockoutTieDto[];
}

export interface EuropeAdvanceResultDto {
  resolvedRound: KnockoutRound;
  resolvedTies: KnockoutTieDto[];
  next?: EuropeRoundDto;
  champion?: string;
}

export type JanuaryEventType = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface JanuaryPlayerDto {
  id: string;
  name: string;
  overall: number;
  position: string;
}

export interface JanuaryInPlayerDto extends JanuaryPlayerDto {
  clubName: string;
  seasonYear: number;
}

export interface JanuaryResultDto {
  eventType: JanuaryEventType;
  outPlayer: JanuaryPlayerDto;
  inPlayer: JanuaryInPlayerDto;
  delta: number;
}

// Hand-mirrored from @futbol/domain's TrophyKey (apps/web has zero workspace deps by design —
// see CLAUDE.md — so this stays a plain string union kept in sync by hand, same as JanuaryEventType).
export type TrophyKey =
  | "invincible"
  | "unbeaten"
  | "champions"
  | "golden-boot"
  | "playmaker"
  | "golden-glove"
  | "mvp"
  | "club-record-breaker"
  | "club-worst-ever";

export interface FinalizeRunResultDto {
  trophies: TrophyKey[];
  awards: { worldId: string; seasonId: string; name: string; winnerId: string }[];
  records: { worldId: string; name: string; holderId: string; value: number }[];
}

export interface WorldHistoryRowDto {
  worldId: string;
  createdAt: string;
  status: string;
  clubName: string | null;
  formation: string | null;
  pointsTotal: number | null;
  trophies: TrophyKey[];
}

export type LeaderboardDifficulty = "easy" | "normal" | "hard";
export type LeaderboardRatingsMode = "season" | "prime";
export type LeaderboardTimeWindow = "today" | "week" | "all";

export interface SubmitLeaderboardDto {
  handle: string;
  difficulty: LeaderboardDifficulty;
  ratingsMode: LeaderboardRatingsMode;
}

export interface LeaderboardEntryDto {
  id: string;
  worldId: string;
  userId: string;
  handle: string;
  mode: string;
  difficulty: LeaderboardDifficulty;
  ratingsMode: LeaderboardRatingsMode;
  formation: string;
  squadOverall: number;
  clubName: string;
  leagueName: string | null;
  /** Set only for mode="one-club" (Phase 7) — the RefClub this run was locked to. */
  refClubId: string | null;
  won: number;
  drawn: number;
  lost: number;
  goalDiff: number;
  points: number;
  verified: boolean;
  reportCount: number;
  createdAt: string;
}

/** Submission also returns any trophy newly unlocked *by this submission specifically*
    (club-record-breaker/club-worst-ever, Phase 7) — comparative trophies that can only be known at
    the moment of submission, unlike finalizeRun's per-run trophies. */
export interface SubmitLeaderboardResultDto {
  entry: LeaderboardEntryDto;
  newTrophies: TrophyKey[];
}

export interface LeaderboardQuery {
  mode?: string;
  difficulty?: LeaderboardDifficulty;
  ratingsMode?: LeaderboardRatingsMode;
  formation?: string;
  leagueName?: string;
  refClubId?: string;
  timeWindow?: LeaderboardTimeWindow;
  limit?: number;
}
