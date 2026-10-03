import type { TrophyCategory, TrophyKey, TrophyTier } from "../api/types";

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
  "european-champion": {
    name: "Kings of Europe",
    description: "Won the European competition's Final.",
    icon: "🏆",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "the-double": {
    name: "The Double",
    description: "Won the league and the European competition in the same season.",
    icon: "👑",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "top-four": {
    name: "Top Four",
    description: "Finished in the top four.",
    icon: "4️⃣",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  centurion: {
    name: "Centurion",
    description: "Hit 100 points — or the same pace (2.63 a game) in a 34-game league.",
    icon: "💯",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "goal-machine": {
    name: "Goal Machine",
    description: "Averaged 2.5 goals a game over a league season (95 in 38).",
    icon: "🔥",
    colorClass: "text-crimson-300 border-crimson-400/60",
  },
  fortress: {
    name: "Fortress",
    description: "Conceded 0.6 goals a game or fewer over a league season (22 in 38).",
    icon: "🧱",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  overachievers: {
    name: "Overachievers",
    description: "Finished five or more places above the draft room's projection.",
    icon: "📈",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  miracle: {
    name: "Miracle Season",
    description: "Won the league with an XI projected to finish 8th or lower.",
    icon: "✨",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "great-escape": {
    name: "The Great Escape",
    description: "Stayed up by one place — finished just above the relegation zone.",
    icon: "🪂",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  "bottle-job": {
    name: "Bottle Job",
    description: "Projected to win the league, finished outside the top four.",
    icon: "🍾",
    colorClass: "text-crimson-300 border-crimson-400/60",
  },
  relegated: {
    name: "Down With the Ship",
    description: "Got relegated. It happens to the best of us.",
    icon: "⚓",
    colorClass: "text-crimson-300 border-crimson-400/60",
  },
  "united-nations": {
    name: "United Nations",
    description: "Won the league with eleven different nationalities in the XI.",
    icon: "🌐",
    colorClass: "text-plum-300 border-plum-400/60",
  },
  homegrown: {
    name: "Homegrown",
    description: "Won the league with an XI entirely from the league's own country.",
    icon: "🏠",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  "foreign-legion": {
    name: "Foreign Legion",
    description: "Won the league without a single player from the league's own country.",
    icon: "🧳",
    colorClass: "text-plum-300 border-plum-400/60",
  },
  "class-of": {
    name: "Class Of",
    description: "Won the league with all eleven drafted from the same season.",
    icon: "🎓",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  "time-travellers": {
    name: "Time Travellers",
    description: "Won the league with an XI drafted from eight or more different seasons.",
    icon: "⏳",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  "band-of-brothers": {
    name: "Band of Brothers",
    description: "Won the league with five or more players from the same real club.",
    icon: "🤝",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  "dads-army": {
    name: "Dad's Army",
    description: "Won the league with an XI averaging 30 or older.",
    icon: "🧓",
    colorClass: "text-smoke-400 border-smoke-500/60",
  },
  fledglings: {
    name: "Fledglings",
    description: "Won the league with an XI averaging 24 or younger.",
    icon: "🐣",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  "alphabet-soup": {
    name: "Alphabet Soup",
    description: "Six or more surnames in the XI start with the same letter.",
    icon: "🔤",
    colorClass: "text-plum-300 border-plum-400/60",
  },
  regular: {
    name: "Regular",
    description: "Finished five seasons.",
    icon: "📅",
    colorClass: "text-mint-300 border-mint-400/60",
  },
  veteran: {
    name: "Veteran",
    description: "Finished 25 seasons.",
    icon: "🎖️",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  "serial-winner": {
    name: "Serial Winner",
    description: "Won five league titles.",
    icon: "🏅",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  dynasty: {
    name: "Dynasty",
    description: "Won the league in three seasons in a row.",
    icon: "🏰",
    colorClass: "text-amber-300 border-amber-400/60",
  },
  tactician: {
    name: "Tactician",
    description: "Won the league with three different formations.",
    icon: "📋",
    colorClass: "text-teal-300 border-teal-400/60",
  },
  globetrotter: {
    name: "Globetrotter",
    description: "Finished a season in all five leagues.",
    icon: "✈️",
    colorClass: "text-plum-300 border-plum-400/60",
  },
  "five-league-champion": {
    name: "Five-League Champion",
    description: "Won the title in the Premier League, LaLiga, Serie A, the Bundesliga and Ligue 1.",
    icon: "🌟",
    colorClass: "text-amber-300 border-amber-400/60",
  },
};

export const TIER_META: Record<TrophyTier, { label: string; className: string; order: number }> = {
  common: { label: "Common", className: "text-smoke-400", order: 0 },
  rare: { label: "Rare", className: "text-teal-300", order: 1 },
  epic: { label: "Epic", className: "text-plum-300", order: 2 },
  legendary: { label: "Legendary", className: "text-amber-300", order: 3 },
};

export const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  season: "Season",
  awards: "Awards",
  squad: "Squad",
  career: "Career",
  europe: "Europe",
  modes: "Modes",
  fun: "Just for fun",
};
