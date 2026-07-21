import type { LeagueDto } from "../api/types";

interface Props {
  leagues: LeagueDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Exactly one league required, no "All Leagues" escape hatch — used by the single-player draft
      flow now that AI-fill needs one specific real league to build a recognizable current table
      around (see SeasonsService.fillAiClubsFromLeague). Multiplayer's roll-a-club flow still uses
      the default multi-select "All Leagues" mode, unaffected. */
  singleSelect?: boolean;
}

export function LeaguePicker({ leagues, selectedIds, onChange, singleSelect = false }: Props) {
  const sorted = [...leagues].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  function toggle(id: string) {
    if (singleSelect) {
      onChange([id]);
      return;
    }
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  if (leagues.length === 0) {
    return <p className="text-sm text-smoke-500">No leagues available for this era yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {!singleSelect && (
        <button
          type="button"
          onClick={() => onChange([])}
          className={`notch-sm flex min-h-16 flex-col items-center justify-center gap-0.5 border-2 px-3 py-2.5 text-center text-sm font-semibold uppercase tracking-wide transition ${
            selectedIds.length === 0
              ? "border-gold-500 bg-gold-500/10 text-gold-300"
              : "border-ink-700 bg-ink-900/40 text-paper hover:border-ink-600"
          }`}
        >
          All Leagues
        </button>
      )}

      {sorted.map((league) => {
        const active = selectedIds.includes(league.id);
        return (
          <button
            key={league.id}
            type="button"
            onClick={() => toggle(league.id)}
            className={`notch-sm flex min-h-16 flex-col items-center justify-center gap-0.5 border-2 px-3 py-2.5 text-center text-sm transition ${
              active
                ? "border-gold-500 bg-gold-500/10 text-gold-300"
                : "border-ink-700 bg-ink-900/40 text-paper hover:border-ink-600"
            }`}
          >
            <span className="font-medium leading-tight">{league.name}</span>
            {league.tier > 1 && (
              <span className="notch-sm bg-ink-800 px-1.5 py-0.5 text-[10px] text-smoke-500">Tier {league.tier}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
