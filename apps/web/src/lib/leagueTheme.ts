/**
 * League identity: each of the five leagues has a flag, a short name and an accent colour, and the
 * whole site re-themes to the league you're playing (the primary "mint" accent is a CSS variable —
 * see tailwind.config.ts and styles/index.css). England keeps the default green; the others swap
 * the accent only, never the semantic colours (loss = crimson, trophies = amber).
 */

export interface LeagueTheme {
  id: string;
  /** Short display name. */
  name: string;
  /** Country, for <CountryFlag>. */
  country: string;
  /** The accent's 500/400/300 steps as "r g b" triples — what the CSS variables hold. */
  accent: { 500: string; 400: string; 300: string };
  /** The 400 step as hex, for canvas share images. */
  hex: string;
}

export const LEAGUE_THEMES: LeagueTheme[] = [
  {
    id: "league-gb1",
    name: "Premier League",
    country: "England",
    accent: { 500: "31 191 117", 400: "62 217 143", 300: "125 232 182" },
    hex: "#3ed98f",
  },
  {
    id: "league-es1",
    name: "LaLiga",
    country: "Spain",
    accent: { 500: "214 154 52", 400: "230 181 89", 300: "240 205 138" },
    hex: "#e6b559",
  },
  {
    id: "league-it1",
    name: "Serie A",
    country: "Italy",
    accent: { 500: "47 143 224", 400: "89 168 236", 300: "143 197 244" },
    hex: "#59a8ec",
  },
  {
    id: "league-l1",
    name: "Bundesliga",
    country: "Germany",
    accent: { 500: "232 99 52", 400: "240 132 90", 300: "246 171 140" },
    hex: "#f0845a",
  },
  {
    id: "league-fr1",
    name: "Ligue 1",
    country: "France",
    accent: { 500: "139 108 240", 400: "165 140 246", 300: "193 175 250" },
    hex: "#a58cf6",
  },
];

const BY_ID = new Map(LEAGUE_THEMES.map((t) => [t.id, t]));

export function leagueTheme(leagueId: string | undefined): LeagueTheme | undefined {
  return leagueId ? BY_ID.get(leagueId) : undefined;
}

const STORAGE_KEY = "futbol_league_theme";

/** The league last chosen anywhere on the site (landing switcher, Setup), or undefined. */
export function storedLeagueTheme(): string | undefined {
  try {
    const id = localStorage.getItem(STORAGE_KEY) ?? undefined;
    return id && BY_ID.has(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function rememberLeagueTheme(leagueId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, leagueId);
  } catch {
    // Storage blocked — the theme just won't survive a reload.
  }
}

/** Points the page's accent variables at a league (or back to the default green for undefined). */
export function applyLeagueTheme(leagueId: string | undefined): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = leagueTheme(leagueId);
  if (!theme) {
    root.removeAttribute("data-league");
    for (const step of ["500", "400", "300"]) root.style.removeProperty(`--c-mint-${step}`);
    return;
  }
  root.setAttribute("data-league", theme.id);
  root.style.setProperty("--c-mint-500", theme.accent[500]);
  root.style.setProperty("--c-mint-400", theme.accent[400]);
  root.style.setProperty("--c-mint-300", theme.accent[300]);
}
