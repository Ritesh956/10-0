import { FORMATIONS, FORMATION_DESCRIPTIONS, type Formation } from "../lib/formations";
import { PitchView } from "./PitchView";

interface Props {
  value: Formation;
  onChange: (formation: Formation) => void;
}

export function FormationPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {FORMATIONS.map((formation) => {
          const active = formation === value;
          return (
            <button
              key={formation}
              type="button"
              onClick={() => onChange(formation)}
              className={`notch-sm border-2 px-2 py-2.5 text-center text-sm font-display font-semibold transition ${
                active
                  ? "border-mint-500 bg-mint-500/10 text-mint-400"
                  : "border-ink-700 bg-ink-900/40 text-paper hover:border-ink-600"
              }`}
            >
              {formation}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-smoke-500">{FORMATION_DESCRIPTIONS[value]}</p>
      <div className="mx-auto max-w-sm">
        <PitchView formation={value} />
      </div>
    </div>
  );
}
