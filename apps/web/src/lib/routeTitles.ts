import { leagueIdForSlug, leagueLabel } from "./leagues";

const SITE = "Futbol";
const DEFAULT_TITLE = "Futbol — Draft. Simulate. Go Unbeaten.";

/** Exact-path titles; dynamic routes are matched by prefix in routeTitle() below. */
const TITLES: Record<string, string> = {
  "/": DEFAULT_TITLE,
  "/signin": "Sign in",
  "/setup": "Set the rules",
  "/draft": "Draft room",
  "/season": "Your season",
  "/multiplayer": "Play with mates",
  "/profile": "Your profile",
  "/leaderboard": "Leaderboard",
  "/clubs": "One-Club XI",
  "/nations": "Nations",
  "/daily": "Daily Challenge",
  "/daily/archive": "Past dailies",
  "/how-it-works": "How it works",
  "/how-to-play": "How to play",
  "/best-xi": "Best XI of the top five leagues",
  "/story": "Our story",
};

/** Document title for a pathname — every route used to share one <title>, so tabs, history and
    shared links were indistinguishable. */
export function routeTitle(pathname: string): string {
  const exact = TITLES[pathname];
  if (exact) return exact === DEFAULT_TITLE ? exact : `${exact} · ${SITE}`;
  if (/^\/daily\/\d{4}-\d{2}-\d{2}$/.test(pathname)) return `Daily Challenge, ${pathname.slice(7)} · ${SITE}`;
  if (pathname.startsWith("/best-xi/")) {
    const league = leagueLabel(leagueIdForSlug(pathname.slice("/best-xi/".length)));
    if (league) return `Greatest ${league} XI · ${SITE}`;
  }
  if (pathname.startsWith("/multiplayer/live")) return `Live draft · ${SITE}`;
  if (pathname.startsWith("/multiplayer/")) return `League · ${SITE}`;
  return `Page not found · ${SITE}`;
}
