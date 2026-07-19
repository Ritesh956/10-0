import type {
  AuthResponse,
  CatalogFilter,
  ClubSeasonDto,
  EraDto,
  LeagueDto,
  ManagerDto,
  PlayerSeasonDto,
  SeasonDto,
  StandingsDto,
  SummaryDto,
  WorldDto,
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
  return params.toString();
}

class ApiError extends Error {
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

  createWorld: (eraId: string) =>
    request<WorldDto>("/worlds", { method: "POST", body: JSON.stringify({ eraId, type: "SINGLE" }) }),

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

  createSeason: (worldId: string, competitionName: string, size: number) =>
    request<SeasonDto>(`/worlds/${worldId}/seasons`, {
      method: "POST",
      body: JSON.stringify({ competitionName, size }),
    }),

  simulateSeason: (worldId: string, seasonId: string) =>
    request<{ status: string }>(`/worlds/${worldId}/seasons/${seasonId}/simulate`, { method: "POST" }),

  getSeason: (worldId: string, seasonId: string) => request<SeasonDto>(`/worlds/${worldId}/seasons/${seasonId}`),

  getStandings: (worldId: string, seasonId: string) =>
    request<StandingsDto>(`/worlds/${worldId}/seasons/${seasonId}/standings`),

  getSummary: (worldId: string, seasonId: string) =>
    request<SummaryDto>(`/worlds/${worldId}/seasons/${seasonId}/summary`),
};
