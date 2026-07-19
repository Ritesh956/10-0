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
