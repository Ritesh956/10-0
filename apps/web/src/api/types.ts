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
  /** First/last season start year this league actually has club-season data for (null if none). */
  minSeasonYear?: number | null;
  maxSeasonYear?: number | null;
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
  clubSeason: { club: { id: string; name: string } };
}

/** GET /catalog/best-xi?leagueId= — one team-sheet slot of a league's top-rated XI. */
export interface BestXiPlayerDto {
  playerSeasonId: string;
  playerId: string;
  name: string;
  nationality: string;
  photoUrl: string | null;
  clubName: string;
  seasonYear: number;
  overall: number;
  position: string;
}

export interface BestXiSlotDto {
  slot: string;
  pick: BestXiPlayerDto | null;
  alternatives: BestXiPlayerDto[];
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
  /** The country of the league the club plays in (for a flag); null when unknown. */
  country?: string | null;
}

export interface WorldSettingsDto {
  europeanNights: boolean;
  januaryWindow: boolean;
  /** Phase 7 (One-Club XI) — the RefClub this world's draft was locked to, or undefined for a
      normal fantasy-XI world. Read-only from the frontend's perspective (set once at world
      creation); the backend derives leaderboard mode/refClubId from this, never from a submission
      body — see LeaderboardService.submitRun. */
  oneClubClubId?: string;
  /** Phase 9a (async multiplayer Leagues) — the MultiplayerLeague this world's draft belongs to, or
      undefined for a normal world. Set once at world creation; read-only from the frontend's
      perspective, same convention as oneClubClubId. */
  multiplayerLeagueId?: string;
  nationsNationality?: string;
  /** RefLeague id of the league this world's season is played in, when the draft picked one. */
  leagueId?: string;
  /** "all" when the draft wheel spanned all five leagues (All Top-5). */
  draftPool?: "all";
  /** The pre-season projection as the draft room displayed it — the verdict compares against this. */
  projection?: { finish: number; points: number; overall: number };
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
  /** Nations Trophy mode (Phase 10): scopes a club-season pool fetch to only clubs with at least
      one player of this RefPlayer.nationality, or a player-season pool fetch to only that
      nationality's players within the drawn club-season. */
  nationality?: string;
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

/** A distinct nationality represented in the top-5 catalog (Phase 10's Nations Trophy directory,
    the nationality-locked analogue of RealClubDto), with a count of distinct real players. */
export interface NationDto {
  nationality: string;
  playerCount: number;
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

export type KnockoutRound = "PO" | "R16" | "QF" | "SF" | "FINAL";

export interface KnockoutTieDto {
  id: string;
  round: KnockoutRound;
  homeClubId: string;
  awayClubId: string;
  firstLegFixtureId: string | null;
  secondLegFixtureId: string | null;
  winnerClubId: string | null;
  wentToPenalties: boolean;
  /** Aggregate from the tie's own home/away perspective; null/absent until a leg has been played. */
  score?: { homeGoals: number; awayGoals: number; legsPlayed: number } | null;
}

export interface EuropeStatusDto {
  qualified: boolean;
  position: number;
  qualifierCount: number;
  /** Clubs in the cross-league field (36). Optional: older API builds don't send it. */
  clubCount?: number;
  /** The Continental Cup — the second European tier, for a 9th–12th finish. */
  cup?: { qualified: boolean; clubCount: number; competitionId?: string };
  competitionId?: string;
  ties: KnockoutTieDto[];
}

export interface EuropeDrawClubDto {
  clubId: string;
  name: string;
  /** League country — drives the flag. */
  country: string;
  /** 1 = strongest by our squad ratings. */
  seed: number;
  /** 1–4. */
  pot: number;
  /** Average overall of the best eleven. */
  strength: number;
}

export interface EuropeDrawDto {
  clubs: EuropeDrawClubDto[];
}

export interface EuropeCupDto {
  competitionId: string;
  round: EuropeRoundDto;
  draw: EuropeDrawDto;
}

export interface EuropeLeaguePhaseDto {
  competitionId: string;
  seasonId: string;
  draw: EuropeDrawDto;
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

/** The named January events — mirrors apps/api/src/january/january.logic.ts JanuaryEventKind. */
export type JanuaryEventKind =
  | "bargain-buy"
  | "wheeler-dealer"
  | "deadline-day"
  | "loan-swap"
  | "star-wants-out"
  | "border-raid";

export interface JanuaryOptionDto {
  id: string;
  name: string;
  clubName: string;
  seasonYear: number;
  position: string;
}

/** GET .../january/:seasonId/offer — this season's event; `options` only for a choice event. */
export interface JanuaryOfferDto {
  kind: JanuaryEventKind;
  label: string;
  premise: string;
  /** The other league a cross-border event reaches into (flag), else null. Absent on older API builds. */
  league?: { name: string; country: string } | null;
  outPlayer: JanuaryPlayerDto;
  options: JanuaryOptionDto[] | null;
}

export interface JanuaryResultDto {
  eventType: JanuaryEventType;
  /** Absent on results cached before the event layer existed. */
  kind?: JanuaryEventKind;
  label?: string;
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
  | "club-worst-ever"
  | "nations-champion"
  | "european-champion"
  | "the-double"
  | "top-four"
  | "centurion"
  | "goal-machine"
  | "fortress"
  | "overachievers"
  | "miracle"
  | "great-escape"
  | "bottle-job"
  | "relegated"
  | "united-nations"
  | "homegrown"
  | "foreign-legion"
  | "class-of"
  | "time-travellers"
  | "band-of-brothers"
  | "dads-army"
  | "fledglings"
  | "alphabet-soup"
  | "regular"
  | "veteran"
  | "serial-winner"
  | "dynasty"
  | "tactician"
  | "globetrotter"
  | "five-league-champion"
  | "continental-cup"
  | "european-unbeaten"
  | "perfect-eight"
  | "top-of-europe"
  | "grand-tour"
  | "continental-raiders"
  | "five-league-xi";

// Mirrors @futbol/domain's TrophyCategory / TrophyTier.
export type TrophyCategory = "season" | "awards" | "squad" | "career" | "europe" | "modes" | "fun";
export type TrophyTier = "common" | "rare" | "epic" | "legendary";

export interface RunRefDto {
  worldId: string;
  clubName: string | null;
  value: number;
}

export interface StreakDto {
  current: number;
  best: number;
}

export interface CabinetEntryDto {
  key: TrophyKey;
  category: TrophyCategory;
  tier: TrophyTier;
  count: number;
  firstEarnedAt: string | null;
  lastWorldId: string | null;
  progress: { current: number; target: number } | null;
  rarityPct: number | null;
}

export type RunMode = "solo" | "one-club" | "nations" | "league";

export interface ProfileRunDto {
  worldId: string;
  createdAt: string;
  clubName: string | null;
  formation: string | null;
  leagueId: string | null;
  mode: RunMode;
  finished: boolean;
  points: number | null;
  position: number | null;
  leagueSize: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  squadOverall: number | null;
  longestWinStreak: number | null;
  trophies: TrophyKey[];
}

export interface ProfileDto {
  user: { displayName: string; isGuest: boolean; memberSince: string };
  stats: {
    seasonsStarted: number;
    seasonsFinished: number;
    titles: number;
    topFours: number;
    invincibles: number;
    unbeatenSeasons: number;
    europeanTitles: number;
    bestPoints: RunRefDto | null;
    bestRecord: { worldId: string; clubName: string | null; won: number; drawn: number; lost: number; points: number } | null;
    winRate: number | null;
    matchesPlayed: number;
    goalsScored: number;
    averageFinish: number | null;
    favouriteFormation: string | null;
    favouriteLeagueId: string | null;
    topRatedXi: RunRefDto | null;
    bestWinStreak: number | null;
    trophiesEarned: number;
  };
  streaks: { titles: StreakDto; unbeaten: StreakDto; onTheUp: StreakDto; days: StreakDto };
  cabinet: CabinetEntryDto[];
  daily: { played: number; perfect: number; bestScore: number };
  runs: ProfileRunDto[];
}

/** GET /auth/providers — which passwordless sign-in methods this server offers. */
export interface AuthProvidersDto {
  emailLink: boolean;
  google: boolean;
  googleClientId: string | null;
}

/** GET /stats — public counters for the landing page. */
export interface SiteStatsDto {
  seasonsSimulated: number;
  xisDrafted: number;
  matchesPlayed: number;
  invincibles: number;
  topRuns: { handle: string; points: number; won: number; drawn: number; lost: number; leagueName: string | null }[];
}

/** GET /worlds/:worldId/seasons/run-index — what a finished run's stats hub is built from. */
export interface RunIndexDto {
  domesticSeasonId: string | null;
  domesticCompetitionId: string | null;
  finished: boolean;
  userClubId: string | null;
  /** Only once the European Final has a winner. */
  europe: {
    competitionId: string;
    /** 1 = European Nights, 2 = the Continental Cup (knockouts only, so no league phase). */
    tier: 1 | 2;
    leaguePhaseSeasonId: string | null;
    knockoutSeasonIds: string[];
    champion: string | null;
  } | null;
  january: JanuaryResultDto | null;
  trophies: TrophyKey[];
}

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
  nationality?: string;
  timeWindow?: LeaderboardTimeWindow;
  limit?: number;
}

// Phase 8 — Daily Challenge

export type DailyTheme = "birthday" | "nationality" | "club-history";
export type DailyConstraintType = "nationality" | "club";

export interface DailyConstraintDto {
  type: DailyConstraintType;
  /** Nationality name, or clubId for a "club" constraint — matches PlayerSeasonDto's
      `player.nationality` / `clubSeason.club.id` respectively for client-side live tracking. */
  value: string;
  label: string;
  required: number;
  description: string;
}

export interface DailyAnchorDto {
  id: string;
  playerId: string;
  name: string;
  nationality: string;
  overall: number;
  positions: string[];
  photoUrl: string | null;
  clubName: string;
  clubId: string;
}

export interface DailyPoolStatsDto {
  totalPlayers: number;
  /** Aligned with the challenge's `constraints` array. */
  eligiblePerConstraint: number[];
  /** Aligned with `constraints` — club-season ids whose squad has someone satisfying each one; the
      reel leans draws toward these and the completion odds are computed from them. */
  clubSeasonIdsPerConstraint?: string[][];
}

/** GET /daily/yesterday — the previous day's community result. */
export interface DailyRecapDto {
  date: string;
  themeLabel: string;
  players: number;
  topScore: number;
  maxScore: number;
  maxedCount: number;
  fewestAttemptsToMax: number | null;
}

/** GET /daily/:id/me — the signed-in player's own standing today. */
export interface DailyMyEntryDto {
  attemptsUsed: number;
  attemptsRemaining: number;
  bestScore: number | null;
  maxScore: number | null;
}

export interface DailyArchiveRowDto {
  id: string;
  date: string;
  theme: DailyTheme;
  themeLabel: string;
  fixedFormation: string;
  anchorName: string | null;
  maxScore: number;
  players: number;
  topScore: number | null;
}

export type DailyMyArchiveDto = Record<string, { score: number; maxScore: number; attemptsUsed: number }>;

export interface DailyChallengeDto {
  id: string;
  /** "YYYY-MM-DD", UTC. */
  date: string;
  theme: DailyTheme;
  themeLabel: string;
  fixedFormation: string;
  /** ISO timestamp of the next UTC-midnight refresh. */
  refreshesAt: string;
  anchor: DailyAnchorDto;
  constraints: DailyConstraintDto[];
  poolStats: DailyPoolStatsDto;
}

export interface DailyConstraintResultDto {
  constraint: DailyConstraintDto;
  matched: number;
  met: boolean;
  points: number;
}

export interface DailyChallengeEntryDto {
  id: string;
  dailyChallengeId: string;
  userId: string;
  handle: string;
  squadOverall: number;
  score: number;
  maxScore: number;
  attemptsUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitDailyResultDto {
  score: number;
  maxScore: number;
  results: DailyConstraintResultDto[];
  attemptsUsed: number;
  attemptsRemaining: number;
  isNewBest: boolean;
  entry: DailyChallengeEntryDto;
}

// Phase 9a — async multiplayer Leagues

export interface LeagueRulesDto {
  eraId: string;
  leagueIds: string[];
  difficulty: LeaderboardDifficulty;
  formationFreedom: boolean;
  formation?: string;
}

export interface MultiplayerLeagueDto {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  rules: LeagueRulesDto;
  createdAt: string;
}

export interface CreateLeagueDto {
  name: string;
  eraId: string;
  leagueIds: string[];
  difficulty: LeaderboardDifficulty;
  formationFreedom: boolean;
  formation?: string;
}

export interface LeagueMembershipDto {
  id: string;
  leagueId: string;
  userId: string;
  worldId: string | null;
  joinedAt: string;
}

export interface JoinLeagueResultDto {
  league: MultiplayerLeagueDto;
  membership: LeagueMembershipDto;
}

export type LeagueMemberStatus = "not-started" | "in-progress" | "complete";

export interface LeagueStandingsRowDto {
  userId: string;
  worldId: string | null;
  entry: LeaderboardEntryDto | null;
  rank: number | null;
  status: LeagueMemberStatus;
}

// Phase 9b — real-time Live Draft

export type LiveDraftStatus = "LOBBY" | "IN_PROGRESS" | "COMPLETED";

export interface LiveDraftParticipantDto {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  seatIndex: number;
  worldId: string | null;
  joinedAt: string;
}

export interface LiveDraftRoomDto {
  id: string;
  leagueId: string;
  hostUserId: string;
  inviteCode: string;
  maxSeats: number;
  status: LiveDraftStatus;
  currentPickNumber: number;
  turnStartedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  league: MultiplayerLeagueDto;
  participants: LiveDraftParticipantDto[];
}

export interface CreateLiveDraftRoomDto {
  name: string;
  eraId: string;
  leagueIds: string[];
  difficulty: LeaderboardDifficulty;
  formation: string;
  maxSeats: number;
}

export interface JoinLiveDraftResultDto {
  room: LiveDraftRoomDto;
  participant: LiveDraftParticipantDto;
}

/** Mirrors live-draft.gateway.ts's serializeRoom — the payload of every "room:state" WS event. */
export interface LiveDraftStateEvent {
  id: string;
  status: LiveDraftStatus;
  hostUserId: string;
  maxSeats: number;
  currentPickNumber: number;
  turnStartedAt: string | null;
  turnTimeoutMs: number;
  rules: LeagueRulesDto;
  participants: {
    id: string;
    userId: string;
    displayName: string;
    seatIndex: number;
    isActive: boolean;
    pickCount: number;
  }[];
  picks: {
    pickNumber: number;
    participantId: string;
    refPlayerSeasonId: string;
    playerId: string;
  }[];
}

export interface LiveDraftSpinPlayer {
  id: string;
  playerId: string;
  name: string;
  nationality: string;
  photoUrl: string | null;
  positions: string[];
  overall: number;
}

export interface LiveDraftSpinResultEvent {
  club: { id: string; name: string; seasonYear: number };
  players: LiveDraftSpinPlayer[];
}

export interface LiveDraftCompleteEvent {
  results: { userId: string; worldId?: string; error?: string }[];
}

export interface LiveDraftErrorEvent {
  message: string;
}
