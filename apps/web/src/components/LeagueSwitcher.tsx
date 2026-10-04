import { LEAGUE_THEMES } from "../lib/leagueTheme";
import { CountryFlag } from "./CountryFlag";

interface Props {
  value: string | undefined;
  onChange: (leagueId: string) => void;
}

/** The five leagues as flag chips. Picking one re-themes the site and becomes the league you'll play. */
export function LeagueSwitcher({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="League" className="flex flex-wrap items-center justify-center gap-2">
      {LEAGUE_THEMES.map((league) => {
        const active = league.id === value;
        return (
          <button
            key={league.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(league.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "border-mint-500 bg-mint-500/15 text-mint-300"
                : "border-ink-700 bg-ink-900/50 text-smoke-400 hover:border-ink-600 hover:text-paper"
            }`}
          >
            <CountryFlag country={league.country} />
            {league.name}
          </button>
        );
      })}
    </div>
  );
}
