import { z } from "zod";

/** Shared key set for the trophy/Achievement system (Phase 5) — the API evaluates and persists
    these keys as Achievement.key; apps/web hand-mirrors the same string literals into its own
    api/types.ts (per its zero-workspace-deps convention) to drive a purely-display trophy catalog
    (name/description/icon) keyed by the same strings. */
export const trophyKey = z.enum([
  "invincible",
  "unbeaten",
  "champions",
  "golden-boot",
  "playmaker",
  "golden-glove",
  "mvp",
  // Phase 7 (One-Club XI) — evaluated at leaderboard-submission time against prior LeaderboardEntry
  // rows for the same refClubId, not by trophy-evaluation.ts's per-run evaluateTrophies (see
  // leaderboard.logic.ts's evaluateClubRecordTrophies). Real per-season historical standings don't
  // exist anywhere in our dataset (RefClubSeason has no points/table data), so these benchmark
  // against prior *simulated* runs for the club within this game, not real-world history.
  "club-record-breaker",
  "club-worst-ever",
  // Phase 10 (Nations Trophy) — the exclusive trophy for winning the domestic league with a
  // nationality-locked XI. Evaluated by trophy-evaluation.ts's evaluateTrophies alongside
  // "champions" (same position===1 condition), gated on RunSummary.nationsLocked so a normal
  // fantasy-XI title doesn't also earn this one.
  "nations-champion",
  // European competition — evaluated by evaluateTrophies from RunSummary.europeChampion, which
  // finalizeRun derives from the world's CONTINENTAL competition's FINAL tie. SeasonPage calls
  // finalizeRun a second time once Europe finishes (it's idempotent), since the first call runs
  // right after the domestic season, before any European tie exists.
  "european-champion",
  "the-double",
  // P2 (2026-10) — season performance, scaled per game so 34-game leagues aren't locked out.
  "top-four",
  "centurion",
  "goal-machine",
  "fortress",
  "overachievers",
  "miracle",
  "great-escape",
  "bottle-job",
  "relegated",
  // P2 — squad composition: what you drafted, not just how it did. Most need the title too.
  "united-nations",
  "homegrown",
  "foreign-legion",
  "class-of",
  "time-travellers",
  "band-of-brothers",
  "dads-army",
  "fledglings",
  "alphabet-soup",
  // P2 — career milestones, earned once per player (stamped on the run that reached them).
  "regular",
  "veteran",
  "serial-winner",
  "dynasty",
  "tactician",
  "globetrotter",
  "five-league-champion",
  // P3 (2026-10) — cross-league: European Nights is a 36-club field from all five leagues.
  "continental-cup",
  "european-unbeaten",
  "perfect-eight",
  "top-of-europe",
  "grand-tour",
  "continental-raiders",
  "five-league-xi",
  // P3 — the Nations Cup tournament (your XI v national teams built from the catalog).
  "nations-cup-winner",
]);
export type TrophyKey = z.infer<typeof trophyKey>;

export type TrophyCategory = "season" | "awards" | "squad" | "career" | "europe" | "modes" | "fun";
export type TrophyTier = "common" | "rare" | "epic" | "legendary";

export interface TrophyDef {
  category: TrophyCategory;
  tier: TrophyTier;
  /** Career trophies only: the count the progress bar fills towards. */
  target?: number;
}

/** Category/tier/target for every trophy — the cabinet's ordering is this object's key order.
    Display copy (name/description/icon) is apps/web's lib/trophies.ts. */
export const TROPHY_DEFS: Record<TrophyKey, TrophyDef> = {
  champions: { category: "season", tier: "common" },
  "top-four": { category: "season", tier: "common" },
  unbeaten: { category: "season", tier: "epic" },
  invincible: { category: "season", tier: "legendary" },
  centurion: { category: "season", tier: "epic" },
  "goal-machine": { category: "season", tier: "rare" },
  fortress: { category: "season", tier: "rare" },
  overachievers: { category: "season", tier: "rare" },
  miracle: { category: "season", tier: "legendary" },

  "golden-boot": { category: "awards", tier: "common" },
  playmaker: { category: "awards", tier: "common" },
  "golden-glove": { category: "awards", tier: "common" },
  mvp: { category: "awards", tier: "common" },

  "united-nations": { category: "squad", tier: "epic" },
  homegrown: { category: "squad", tier: "legendary" },
  "foreign-legion": { category: "squad", tier: "rare" },
  "class-of": { category: "squad", tier: "rare" },
  "time-travellers": { category: "squad", tier: "rare" },
  "band-of-brothers": { category: "squad", tier: "rare" },
  "dads-army": { category: "squad", tier: "rare" },
  fledglings: { category: "squad", tier: "epic" },

  regular: { category: "career", tier: "common", target: 5 },
  veteran: { category: "career", tier: "rare", target: 25 },
  "serial-winner": { category: "career", tier: "epic", target: 5 },
  dynasty: { category: "career", tier: "epic", target: 3 },
  tactician: { category: "career", tier: "epic", target: 3 },
  globetrotter: { category: "career", tier: "rare", target: 5 },
  "five-league-champion": { category: "career", tier: "legendary", target: 5 },

  "five-league-xi": { category: "squad", tier: "epic" },

  "european-champion": { category: "europe", tier: "rare" },
  "the-double": { category: "europe", tier: "epic" },
  "continental-cup": { category: "europe", tier: "common" },
  "top-of-europe": { category: "europe", tier: "rare" },
  "european-unbeaten": { category: "europe", tier: "epic" },
  "grand-tour": { category: "europe", tier: "epic" },
  "perfect-eight": { category: "europe", tier: "legendary" },
  "continental-raiders": { category: "europe", tier: "legendary" },

  "nations-champion": { category: "modes", tier: "epic" },
  "nations-cup-winner": { category: "modes", tier: "legendary" },
  "club-record-breaker": { category: "modes", tier: "rare" },
  "club-worst-ever": { category: "modes", tier: "common" },

  "great-escape": { category: "fun", tier: "rare" },
  "bottle-job": { category: "fun", tier: "rare" },
  relegated: { category: "fun", tier: "common" },
  "alphabet-soup": { category: "fun", tier: "rare" },
};
