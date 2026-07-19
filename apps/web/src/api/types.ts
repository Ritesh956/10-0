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
  player: { name: string; nationality: string };
  clubSeason: { club: { name: string } };
}

export interface WorldClubDto {
  id: string;
  name: string;
  managedByUserId: string | null;
  refClubSeasonId: string | null;
}

export interface WorldDto {
  id: string;
  ownerId: string;
  eraId: string;
  type: string;
  status: string;
  clubs: WorldClubDto[];
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

export interface SummaryDto {
  standings: StandingsDto;
  userClub?: { id: string; name: string };
  userRow?: StandingsRowDto;
  position?: number;
  unbeaten: boolean;
  shareText?: string;
}

export interface CatalogFilter {
  eraId?: string;
  leagueIds?: string[];
  positions?: string[];
  clubSeasonId?: string;
}
