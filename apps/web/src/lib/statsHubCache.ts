/** localStorage key for a finished run's cached stats hub (written by SeasonPage). */
export function statsHubCacheKey(worldId: string): string {
  return `futbol_stats_hub_${worldId}`;
}

/** Whether this browser still has a run's stats hub cached — the hub is only rebuilt from this
    cache, so the profile only links runs that have one. */
export function hasStatsHubCache(worldId: string): boolean {
  try {
    return localStorage.getItem(statsHubCacheKey(worldId)) !== null;
  } catch {
    return false;
  }
}
