import { leagueTheme } from "../lib/leagueTheme";
import { CountryFlag } from "./CountryFlag";

/** Flag + league name, for headers and result screens. Renders nothing for an unknown league. */
export function LeagueBadge({ leagueId, className = "" }: { leagueId: string | undefined; className?: string }) {
  const theme = leagueTheme(leagueId);
  if (!theme) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-mint-500/40 bg-mint-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-mint-300 ${className}`}
    >
      <CountryFlag country={theme.country} />
      {theme.name}
    </span>
  );
}
