export interface PreseasonOdds {
  seasonSize: number;
  expectedPoints: number;
  winPct: number;
  top4Pct: number;
  top6Pct: number;
  top10Pct: number;
  relegationPct: number;
  projectedFinish: number;
}

/** Pre-season projection shown on the draft confirm screen. Every stat is derived from ONE
    continuous expected-finish position (via a logistic rank distribution) rather than separate
    hand-tuned curves per stat — those used to disagree with each other (e.g. a squad "projected
    7th" could simultaneously show ~40% to win the league, which makes no sense together).
    Also reused by lib/seasonNarrative.ts at season-end (recomputed from the squad's overall at
    that point) to derive a "projected finish" for the verdict-tag signal — actual finish vs. what
    a squad of that overall should produce. */
export function computePreseasonOdds(overallRating: number): PreseasonOdds {
  // SEASON_SIZE mirrors the real top-flight-sized league SeasonPage actually simulates
  // (see apps/web/src/pages/SeasonPage.tsx's createSeason call) — keep the two in sync.
  const seasonSize = 20;
  const matches = (seasonSize - 1) * 2;
  // A hard 55-90 clamp saturated `strength` to 1 for almost any good squad (overall 90+
  // is common), making every strong draft show the same "90% to win it" numbers. A logistic
  // curve centered on a realistic "mid-table top-flight XI" benchmark keeps differentiating
  // squads all the way up near the top of the rating scale instead of flatlining early.
  const MID_OVERALL = 75;
  const SPREAD = 8;
  const strength = 1 / (1 + Math.exp(-(overallRating - MID_OVERALL) / SPREAD));
  const ppg = 0.6 + strength * 2; // ~0.6 (relegation form) to ~2.6 (title-winning pace) points/game

  const meanRank = seasonSize - strength * (seasonSize - 1); // continuous, e.g. ~6.6 for a strong-but-not-dominant XI
  const RANK_SPREAD = 3.5; // typical +/- finish-position swing a team of given quality sees season to season
  const LOGISTIC_SCALE = RANK_SPREAD / 1.814; // logistic-distribution scale matching that spread's std dev
  const rankCdf = (threshold: number) => 1 / (1 + Math.exp((meanRank - threshold) / LOGISTIC_SCALE));

  return {
    seasonSize,
    expectedPoints: Math.round(ppg * matches),
    winPct: Math.max(1, Math.min(95, Math.round(rankCdf(1) * 100))),
    top4Pct: Math.max(1, Math.min(99, Math.round(rankCdf(4) * 100))),
    // top6/top10 read off the same continuous rank distribution as win/top4/relegation — rankCdf
    // is monotonically increasing in its threshold, so win <= top4 <= top6 <= top10 falls out for
    // free rather than needing separately hand-tuned curves that could disagree with each other.
    top6Pct: Math.max(1, Math.min(99, Math.round(rankCdf(6) * 100))),
    top10Pct: Math.max(1, Math.min(99, Math.round(rankCdf(10) * 100))),
    relegationPct: Math.max(0, Math.min(90, Math.round((1 - rankCdf(seasonSize - 3)) * 100))),
    projectedFinish: Math.max(1, Math.min(seasonSize, Math.round(meanRank))),
  };
}
