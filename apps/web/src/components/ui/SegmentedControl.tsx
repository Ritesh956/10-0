export type SegmentedAccent = "gold" | "crimson" | "plum" | "teal";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: SegmentedAccent;
  columns?: 2 | 3 | 4;
}

/** Full literal class strings so Tailwind's JIT scanner picks them up. */
const ACCENT_CLASSES: Record<SegmentedAccent, { border: string; bg: string; text: string }> = {
  gold: { border: "border-gold-500", bg: "bg-gold-500/10", text: "text-gold-400" },
  crimson: { border: "border-crimson-500", bg: "bg-crimson-500/10", text: "text-crimson-400" },
  plum: { border: "border-plum-500", bg: "bg-plum-500/10", text: "text-plum-400" },
  teal: { border: "border-teal-500", bg: "bg-teal-500/10", text: "text-teal-400" },
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent = "gold",
  columns = options.length as 2 | 3 | 4,
}: Props<T>) {
  const accentClasses = ACCENT_CLASSES[accent];
  const gridCols = columns === 4 ? "sm:grid-cols-4" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`notch border-2 p-4 text-left transition ${
              active
                ? `${accentClasses.border} ${accentClasses.bg}`
                : "border-ink-700 bg-ink-900/50 hover:border-ink-600"
            }`}
          >
            <div className={`font-display font-semibold uppercase tracking-wide ${active ? accentClasses.text : "text-paper"}`}>
              {option.label}
            </div>
            {option.description && <div className="mt-0.5 text-xs text-smoke-500">{option.description}</div>}
          </button>
        );
      })}
    </div>
  );
}
