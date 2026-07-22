import type { TrophyKey } from "../api/types";

export interface TrophyMeta {
  name: string;
  description: string;
  icon: string;
  colorClass: string;
}

/** Display catalog for the trophy/Achievement system — keyed by the same TrophyKey strings the
    backend evaluates and persists (see apps/api/src/seasons/trophy-evaluation.ts). The backend
    decides WHAT was unlocked; this catalog decides HOW to show it (name/description/icon/color),
    reusing the existing accent palette rather than inventing new hues. */
export const TROPHY_CATALOG: Record<TrophyKey, TrophyMeta> = {
  invincible: {
    name: "The Invincible",
    description: "Won every single match — a perfect, undefeated season.",
    icon: "🏆",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  unbeaten: {
    name: "Unbeaten",
    description: "Went the whole season without losing a match.",
    icon: "🛡️",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  champions: {
    name: "Champions",
    description: "Won the league title.",
    icon: "👑",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "golden-boot": {
    name: "Golden Boot",
    description: "Your club's player finished as the competition's top scorer.",
    icon: "⚽",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  playmaker: {
    name: "Playmaker",
    description: "Your club's player finished as the competition's top assister.",
    icon: "🎯",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  "golden-glove": {
    name: "Golden Glove",
    description: "Your goalkeeper kept the most clean sheets in the competition.",
    icon: "🧤",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  mvp: {
    name: "MVP",
    description: "Your club's player was the competition's standout performer.",
    icon: "⭐",
    colorClass: "text-plum-300 border-plum-400/60",
  },
  "club-record-breaker": {
    name: "Club Record Breaker",
    description: "The best points total anyone has ever posted with this club's One-Club XI.",
    icon: "📈",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "club-worst-ever": {
    name: "Club Worst Ever",
    description: "The lowest points total anyone has ever posted with this club's One-Club XI.",
    icon: "📉",
    colorClass: "text-crimson-300 border-crimson-400/60",
  },
  "nations-champion": {
    name: "Golden Generation",
    description: "Won the league with a squad drafted entirely from one nation's players.",
    icon: "🌍",
    colorClass: "text-plum-300 border-plum-400/60",
  },
};
