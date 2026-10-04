import { motion } from "framer-motion";
import { SPRING_SNAPPY } from "../../lib/motion";

export type SegmentedAccent = "mint" | "crimson" | "plum" | "teal" | "amber";

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
  mint: { border: "border-mint-500", bg: "bg-mint-500/10", text: "text-mint-400" },
  crimson: { border: "border-crimson-500", bg: "bg-crimson-500/10", text: "text-crimson-400" },
  plum: { border: "border-plum-500", bg: "bg-plum-500/10", text: "text-plum-400" },
  teal: { border: "border-teal-500", bg: "bg-teal-500/10", text: "text-teal-400" },
  amber: { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-300" },
};

const GRID_COLS: Record<2 | 3 | 4, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };

/** Compact 2-4-up segmented control (it used to stack every option as a full-width tile on phones,
    which made Setup ~5 screens long). Options stay side by side at every width; only the selected
    option's description is shown, as one line underneath, instead of a paragraph per tile. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent = "mint",
  columns = Math.min(4, options.length) as 2 | 3 | 4,
}: Props<T>) {
  const accentClasses = ACCENT_CLASSES[accent];
  const selected = options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5">
      <div className={`grid gap-2 ${GRID_COLS[columns]}`} role="radiogroup">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <motion.button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.description}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SNAPPY}
              onClick={() => onChange(option.value)}
              className={`notch-sm border px-3 py-2.5 text-center text-sm font-semibold transition ${
                active ? `${accentClasses.border} ${accentClasses.bg} ${accentClasses.text}` : "border-ink-700 bg-ink-900/50 text-paper hover:border-ink-600"
              }`}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>
      {selected?.description && <p className="text-xs text-smoke-500">{selected.description}</p>}
    </div>
  );
}
