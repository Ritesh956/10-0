import { api } from "../api/client";
import type {
  CompetitionStatsDto,
  JanuaryResultDto,
  KnockoutTieDto,
  ManagerStatsDto,
  MatchSummaryDto,
  StandingsDto,
  SummaryDto,
  TeamStatsDto,
  TrophyKey,
} from "../api/types";

export interface CachedStatsHub {
  standings: StandingsDto;
  teamStats: TeamStatsDto | null;
  leagueCompetitionStats: CompetitionStatsDto | null;
  qualified: boolean;
  europeLeagueStandings: StandingsDto | null;
  europeCompetitionStats: CompetitionStatsDto | null;
  europeTeamStats: TeamStatsDto | null;
  allTies: KnockoutTieDto[];
  champion: string | null;
  summary: SummaryDto;
  /** Optional for backward compat with cache entries saved before the persistent match log existed. */
  domesticMatches?: MatchSummaryDto[];
  europeMatches?: MatchSummaryDto[];
  /** null = January was off, or the user declined the gamble. Optional for backward compat with
      cache entries saved before the January Transfer Window existed. Feeds the season narrative's
      January recap lines and the two-way "Share your January" card. */
  januaryOutcome?: JanuaryResultDto | null;
  /** Domestic-only (38-0's own manager stat card has no per-competition split) — null for a
      manager-less club or a world with no userClub. Optional for backward compat. */
  leagueManagerStats?: ManagerStatsDto | null;
  /** Trophies unlocked this run (SeasonsService.finalizeRun's persisted Achievement rows echoed
      straight back). Optional for backward compat with cache entries saved before Phase 5. */
  trophies?: TrophyKey[];
  /** The domestic Season's id — needed to submit this run to the leaderboard (Phase 6), which is
      scoped to a season the same way finalizeRun is. Optional for backward compat; a cache entry
      saved before Phase 6 just won't offer the submit block until the next fresh run. */
  domesticSeasonId?: string;
}

/** localStorage key for a finished run's cached stats hub. */
export function statsHubCacheKey(worldId: string): string {
  return `futbol_stats_hub_${worldId}`;
}

// A finished run's standings/stats are cached per-world so leaving /season and coming back (or
// just reloading) lands straight back on the stats hub instead of re-running the whole animated
// pipeline for data that hasn't changed — "easy to navigate anytime unless you start a new run"
// falls out naturally, since a new draft always gets a new worldId and finds no cache entry.
export function saveStatsHubCache(worldId: string, data: CachedStatsHub): void {
  try {
    localStorage.setItem(statsHubCacheKey(worldId), JSON.stringify(data));
  } catch {
    // Storage full or unavailable — not worth failing the season over, the user just won't get
    // the fast-path back to this screen next time.
  }
}

export function loadStatsHubCache(worldId: string): CachedStatsHub | null {
  try {
    const raw = localStorage.getItem(statsHubCacheKey(worldId));
    return raw ? (JSON.parse(raw) as CachedStatsHub) : null;
  } catch {
    return null;
  }
}

/**
 * Rebuilds a finished run's stats hub from the server, for a run this browser never cached (another
 * device, cleared storage, or opened from the profile). Uses the same endpoints the season pipeline
 * reads at the end of a run, so the result is the same bundle the pipeline would have cached.
 * Null when the run isn't finished (or has no club of the user's in it).
 */
export async function rebuildStatsHub(worldId: string): Promise<CachedStatsHub | null> {
  const index = await api.getRunIndex(worldId);
  const { domesticSeasonId: seasonId, domesticCompetitionId: competitionId, userClubId: clubId, europe } = index;
  if (!index.finished || !seasonId || !competitionId || !clubId) return null;

  const [standings, domesticMatches, teamStats, leagueCompetitionStats, leagueManagerStats, summary] = await Promise.all([
    api.getStandings(worldId, seasonId),
    api.getMatchesWithEvents(worldId, seasonId),
    api.getTeamStats(worldId, seasonId, clubId),
    api.getCompetitionStats(worldId, competitionId),
    api.getManagerStats(worldId, competitionId, clubId),
    api.getSummary(worldId, seasonId),
  ]);

  const europeData = europe
    ? await Promise.all([
        api.getLeaguePhaseStandings(worldId, europe.leaguePhaseSeasonId),
        api.getCompetitionStats(worldId, europe.competitionId),
        api.getTeamStatsForCompetition(worldId, europe.competitionId, clubId),
        api.getEuropeBracket(worldId, europe.competitionId),
        Promise.all(
          [europe.leaguePhaseSeasonId, ...europe.knockoutSeasonIds].map((id) => api.getMatchesWithEvents(worldId, id)),
        ),
      ])
    : null;

  return {
    standings,
    teamStats,
    leagueCompetitionStats,
    qualified: europeData !== null,
    europeLeagueStandings: europeData?.[0] ?? null,
    europeCompetitionStats: europeData?.[1] ?? null,
    europeTeamStats: europeData?.[2] ?? null,
    allTies: europeData?.[3] ?? [],
    champion: europe?.champion ?? null,
    summary,
    domesticMatches,
    europeMatches: europeData?.[4].flat() ?? [],
    januaryOutcome: index.january,
    leagueManagerStats,
    trophies: index.trophies,
    domesticSeasonId: seasonId,
  };
}
