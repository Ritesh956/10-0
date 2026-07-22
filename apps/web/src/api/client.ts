import type {
  AuthResponse,
  CatalogFilter,
  ClubSeasonDto,
  CompetitionStatsDto,
  CreateLeagueDto,
  CreateLiveDraftRoomDto,
  DailyChallengeDto,
  DailyChallengeEntryDto,
  EraDto,
  EuropeAdvanceResultDto,
  EuropeLeaguePhaseDto,
  EuropeRoundDto,
  EuropeStatusDto,
  FinalizeRunResultDto,
  JanuaryResultDto,
  JoinLeagueResultDto,
  JoinLiveDraftResultDto,
  KnockoutRound,
  KnockoutTieDto,
  LeaderboardEntryDto,
  LeaderboardQuery,
  LeagueDto,
  LeagueStandingsRowDto,
  LiveDraftRoomDto,
  ManagerDto,
  ManagerStatsDto,
  MatchSummaryDto,
  MultiplayerLeagueDto,
  NationDto,
  PlayerSeasonDto,
  RealClubDto,
  SeasonDto,
  StandingsDto,
  SubmitDailyResultDto,
  SubmitLeaderboardDto,
  SubmitLeaderboardResultDto,
  SummaryDto,
  TeamStatsDto,
  WorldDto,
  WorldHistoryRowDto,
} from "./types";

const API_BASE_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "futbol_token";

let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return authToken;
}

function toQuery(filter: CatalogFilter): string {
  const params = new URLSearchParams();
  if (filter.eraId) params.set("eraId", filter.eraId);
  if (filter.leagueIds?.length) params.set("leagueIds", filter.leagueIds.join(","));
  if (filter.positions?.length) params.set("positions", filter.positions.join(","));
  if (filter.clubSeasonId) params.set("clubSeasonId", filter.clubSeasonId);
  if (filter.ratingsMode) params.set("ratingsMode", filter.ratingsMode);
  if (filter.clubId) params.set("clubId", filter.clubId);
  if (filter.nationality) params.set("nationality", filter.nationality);
  return params.toString();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: unknown };
    const message = typeof body.message === "string" ? body.message : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  guest: (displayName: string) =>
    request<AuthResponse>("/auth/guest", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    }),

  upgradeAccount: (email: string, password: string) =>
    request<AuthResponse>("/auth/upgrade", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listEras: () => request<EraDto[]>("/catalog/eras"),

  listLeagues: (eraId?: string) =>
    request<LeagueDto[]>(`/catalog/leagues${eraId ? `?eraId=${eraId}` : ""}`),

  listClubSeasons: (filter: CatalogFilter) => request<ClubSeasonDto[]>(`/catalog/club-seasons?${toQuery(filter)}`),

  rollClubSeason: (filter: CatalogFilter) => request<ClubSeasonDto>(`/catalog/roll?${toQuery(filter)}`),

  listPlayerSeasons: (filter: CatalogFilter) =>
    request<PlayerSeasonDto[]>(`/catalog/player-seasons?${toQuery(filter)}`),

  listManagers: () => request<ManagerDto[]>("/catalog/managers"),

  rollManager: () => request<ManagerDto>("/catalog/roll-manager"),

  listClubs: () => request<RealClubDto[]>("/catalog/clubs"),

  getClubPositionCoverage: (clubId: string, eraId?: string) =>
    request<string[]>(`/catalog/clubs/${clubId}/positions${eraId ? `?eraId=${eraId}` : ""}`),

  listNations: () => request<NationDto[]>("/catalog/nations"),

  createWorld: (
    eraId: string,
    settings?: {
      europeanNights: boolean;
      januaryWindow: boolean;
      oneClubClubId?: string;
      multiplayerLeagueId?: string;
      nationsNationality?: string;
    },
  ) => request<WorldDto>("/worlds", { method: "POST", body: JSON.stringify({ eraId, type: "SINGLE", settings }) }),

  listWorlds: () => request<WorldDto[]>("/worlds"),

  getWorld: (worldId: string) => request<WorldDto>(`/worlds/${worldId}`),

  draftClub: (worldId: string, refClubSeasonId: string, formation: string) =>
    request(`/worlds/${worldId}/draft/club`, {
      method: "POST",
      body: JSON.stringify({ refClubSeasonId, formation }),
    }),

  draftFantasy: (
    worldId: string,
    name: string,
    formation: string,
    refPlayerSeasonIds: string[],
    refManagerId?: string,
  ) =>
    request(`/worlds/${worldId}/draft/fantasy`, {
      method: "POST",
      body: JSON.stringify({ name, formation, refPlayerSeasonIds, refManagerId }),
    }),

  createSeason: (worldId: string, competitionName: string, opts: { size?: number; leagueId?: string | undefined }) =>
    request<SeasonDto>(`/worlds/${worldId}/seasons`, {
      method: "POST",
      body: JSON.stringify({ competitionName, ...opts }),
    }),

  simulateSeason: (worldId: string, seasonId: string, opts?: { throughMatchday?: number }) =>
    request<{ status: string }>(`/worlds/${worldId}/seasons/${seasonId}/simulate`, {
      method: "POST",
      body: JSON.stringify(opts ?? {}),
    }),

  getSeason: (worldId: string, seasonId: string) => request<SeasonDto>(`/worlds/${worldId}/seasons/${seasonId}`),

  getStandings: (worldId: string, seasonId: string) =>
    request<StandingsDto>(`/worlds/${worldId}/seasons/${seasonId}/standings`),

  getSummary: (worldId: string, seasonId: string) =>
    request<SummaryDto>(`/worlds/${worldId}/seasons/${seasonId}/summary`),

  getMatchesWithEvents: (worldId: string, seasonId: string) =>
    request<MatchSummaryDto[]>(`/worlds/${worldId}/seasons/${seasonId}/matches`),

  getTeamStats: (worldId: string, seasonId: string, clubId: string) =>
    request<TeamStatsDto>(`/worlds/${worldId}/seasons/${seasonId}/team-stats?clubId=${clubId}`),

  getCompetitionStats: (worldId: string, competitionId: string) =>
    request<CompetitionStatsDto>(`/worlds/${worldId}/seasons/competitions/${competitionId}/stats`),

  getTeamStatsForCompetition: (worldId: string, competitionId: string, clubId: string) =>
    request<TeamStatsDto>(`/worlds/${worldId}/seasons/competitions/${competitionId}/team-stats?clubId=${clubId}`),

  getManagerStats: (worldId: string, competitionId: string, clubId: string) =>
    request<ManagerStatsDto>(`/worlds/${worldId}/seasons/competitions/${competitionId}/manager-stats?clubId=${clubId}`),

  getEuropeStatus: (worldId: string, domesticSeasonId: string) =>
    request<EuropeStatusDto>(`/worlds/${worldId}/europe/status?domesticSeasonId=${domesticSeasonId}`),

  startEuropeLeaguePhase: (worldId: string, domesticSeasonId: string) =>
    request<EuropeLeaguePhaseDto>(`/worlds/${worldId}/europe/league-phase?domesticSeasonId=${domesticSeasonId}`, {
      method: "POST",
    }),

  startEuropeKnockouts: (worldId: string, competitionId: string, leaguePhaseSeasonId: string) =>
    request<EuropeRoundDto>(
      `/worlds/${worldId}/europe/${competitionId}/knockouts?leaguePhaseSeasonId=${leaguePhaseSeasonId}`,
      { method: "POST" },
    ),

  advanceEuropeKnockouts: (worldId: string, competitionId: string, round: KnockoutRound) =>
    request<EuropeAdvanceResultDto>(`/worlds/${worldId}/europe/${competitionId}/advance?round=${round}`, {
      method: "POST",
    }),

  getEuropeBracket: (worldId: string, competitionId: string) =>
    request<KnockoutTieDto[]>(`/worlds/${worldId}/europe/${competitionId}/bracket`),

  getLeaguePhaseStandings: (worldId: string, seasonId: string) =>
    request<StandingsDto>(`/worlds/${worldId}/europe/league-phase-standings?seasonId=${seasonId}`),

  resolveJanuaryGamble: (worldId: string, seasonId: string) =>
    request<JanuaryResultDto>(`/worlds/${worldId}/january/${seasonId}/resolve`, { method: "POST" }),

  finalizeRun: (worldId: string, seasonId: string) =>
    request<FinalizeRunResultDto>(`/worlds/${worldId}/seasons/${seasonId}/finalize`, { method: "POST" }),

  getHistory: () => request<WorldHistoryRowDto[]>("/worlds/history"),

  submitToLeaderboard: (worldId: string, seasonId: string, dto: SubmitLeaderboardDto) =>
    request<SubmitLeaderboardResultDto>(`/worlds/${worldId}/seasons/${seasonId}/leaderboard`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  getLeaderboard: (query: LeaderboardQuery = {}) => {
    const params = new URLSearchParams();
    if (query.mode) params.set("mode", query.mode);
    if (query.difficulty) params.set("difficulty", query.difficulty);
    if (query.ratingsMode) params.set("ratingsMode", query.ratingsMode);
    if (query.formation) params.set("formation", query.formation);
    if (query.leagueName) params.set("leagueName", query.leagueName);
    if (query.refClubId) params.set("refClubId", query.refClubId);
    if (query.nationality) params.set("nationality", query.nationality);
    if (query.timeWindow) params.set("timeWindow", query.timeWindow);
    if (query.limit) params.set("limit", String(query.limit));
    return request<LeaderboardEntryDto[]>(`/leaderboard?${params.toString()}`);
  },

  reportLeaderboardEntry: (entryId: string) =>
    request<LeaderboardEntryDto>(`/leaderboard/${entryId}/report`, { method: "POST" }),

  getDailyChallenge: () => request<DailyChallengeDto>("/daily/today"),

  getDailyLeaderboard: (challengeId: string, limit = 50) =>
    request<DailyChallengeEntryDto[]>(`/daily/${challengeId}/leaderboard?limit=${limit}`),

  submitDailyAttempt: (challengeId: string, handle: string, picks: string[]) =>
    request<SubmitDailyResultDto>(`/daily/${challengeId}/submit`, {
      method: "POST",
      body: JSON.stringify({ handle, picks }),
    }),

  createLeague: (dto: CreateLeagueDto) =>
    request<MultiplayerLeagueDto>("/leagues", { method: "POST", body: JSON.stringify(dto) }),

  getMyLeagues: () => request<MultiplayerLeagueDto[]>("/leagues/mine"),

  previewLeagueInvite: (code: string) => request<MultiplayerLeagueDto>(`/leagues/invite/${code}`),

  joinLeague: (code: string) => request<JoinLeagueResultDto>(`/leagues/invite/${code}/join`, { method: "POST" }),

  getLeague: (leagueId: string) => request<MultiplayerLeagueDto>(`/leagues/${leagueId}`),

  getLeagueStandings: (leagueId: string) => request<LeagueStandingsRowDto[]>(`/leagues/${leagueId}/standings`),

  createLiveDraftRoom: (dto: CreateLiveDraftRoomDto) =>
    request<LiveDraftRoomDto>("/live-draft", { method: "POST", body: JSON.stringify(dto) }),

  getMyLiveDraftRooms: () => request<LiveDraftRoomDto[]>("/live-draft/mine"),

  previewLiveDraftInvite: (code: string) => request<LiveDraftRoomDto>(`/live-draft/invite/${code}`),

  joinLiveDraftRoom: (code: string) =>
    request<JoinLiveDraftResultDto>(`/live-draft/invite/${code}/join`, { method: "POST" }),

  getLiveDraftRoom: (roomId: string) => request<LiveDraftRoomDto>(`/live-draft/${roomId}`),
};
