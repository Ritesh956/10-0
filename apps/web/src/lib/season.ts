/** Club-seasons are keyed by their starting year (Transfermarkt convention: 2013 = the 2013/14
    season). Every place a season is shown to a user should go through this, never the bare year —
    "Liverpool 2013" is ambiguous, "Liverpool 2013/14" isn't. */
export function formatSeason(startYear: number): string {
  if (!Number.isFinite(startYear) || startYear <= 0) return "";
  const next = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}/${next}`;
}
