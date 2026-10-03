/**
 * The real top-5 European league dataset (packages/db/prisma/seed-real.ts) is seeded
 * additively into the same era as the fictional placeholder dataset (seed.ts), so both
 * are technically selectable from the same catalog endpoints. Product direction is to
 * surface only the real leagues in the draft flow — this whitelist is the single source
 * of truth for "real" vs "fictional" and mirrors tools/data-etl/build_real_catalog.py's
 * TOP5 country map.
 */
export const REAL_LEAGUE_COUNTRIES = ["England", "Spain", "Italy", "Germany", "France"];

export function isRealCountry(country: string): boolean {
  return REAL_LEAGUE_COUNTRIES.includes(country);
}

/** The five real leagues' catalog ids (from the ETL, stable) → country, so a stored leagueId can be
    labelled with its flag without a catalog round trip. */
const LEAGUE_COUNTRY: Record<string, string> = {
  "league-gb1": "England",
  "league-es1": "Spain",
  "league-it1": "Italy",
  "league-l1": "Germany",
  "league-fr1": "France",
};
const LEAGUE_NAME: Record<string, string> = {
  "league-gb1": "Premier League",
  "league-es1": "LaLiga",
  "league-it1": "Serie A",
  "league-l1": "Bundesliga",
  "league-fr1": "Ligue 1",
};

/** "LaLiga" for a known league id, else "". Plain text: it's also drawn into share images. */
export function leagueLabel(leagueId: string | undefined): string {
  return (leagueId && LEAGUE_NAME[leagueId]) || "";
}

/** The country of a known league id (for <CountryFlag>), else undefined. */
export function leagueCountry(leagueId: string | undefined): string | undefined {
  return leagueId ? LEAGUE_COUNTRY[leagueId] : undefined;
}
