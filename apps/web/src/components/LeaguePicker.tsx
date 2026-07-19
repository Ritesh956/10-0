import type { LeagueDto } from "../api/types";
import { Chip } from "./ui/Chip";

interface Props {
  leagues: LeagueDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function LeaguePicker({ leagues, selectedIds, onChange }: Props) {
  const byCountry = new Map<string, LeagueDto[]>();
  for (const league of leagues) {
    const list = byCountry.get(league.country) ?? [];
    list.push(league);
    byCountry.set(league.country, list);
  }
  const countries = [...byCountry.keys()].sort();

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div className="space-y-4">
      <Chip active={selectedIds.length === 0} onClick={() => onChange([])}>
        All leagues
      </Chip>

      {leagues.length === 0 && <p className="text-sm text-smoke-500">No leagues available for this era yet.</p>}

      {countries.map((country) => (
        <div key={country}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-smoke-600">{country}</p>
          <div className="flex flex-wrap gap-2">
            {(byCountry.get(country) ?? [])
              .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
              .map((league) => {
                const active = selectedIds.includes(league.id);
                return (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => toggle(league.id)}
                    className={`notch-sm flex items-center gap-2 border-2 px-3 py-2 text-sm transition ${
                      active
                        ? "border-gold-500 bg-gold-500/10 text-gold-300"
                        : "border-ink-700 bg-ink-900/40 text-paper hover:border-ink-600"
                    }`}
                  >
                    {league.name}
                    {league.tier > 1 && (
                      <span className="bg-ink-800 px-1.5 py-0.5 text-[10px] text-smoke-500">Tier {league.tier}</span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
