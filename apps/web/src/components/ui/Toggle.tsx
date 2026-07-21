import { motion } from "framer-motion";
import { SPRING_SNAPPY } from "../../lib/motion";

export type ToggleAccent = "mint" | "teal" | "crimson";

interface Props {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  accent?: ToggleAccent;
}

const ACCENT_CLASSES: Record<ToggleAccent, { border: string; bg: string; text: string }> = {
  mint: { border: "border-mint-500/50", bg: "bg-mint-500", text: "text-mint-400" },
  teal: { border: "border-teal-500/50", bg: "bg-teal-500", text: "text-teal-400" },
  crimson: { border: "border-crimson-500/50", bg: "bg-crimson-500", text: "text-crimson-400" },
};

export function Toggle({ label, description, checked, onChange, accent = "mint" }: Props) {
  const accentClasses = ACCENT_CLASSES[accent];
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={SPRING_SNAPPY}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`notch-sm flex w-full items-center gap-4 border-2 p-4 text-left transition ${
        checked ? `${accentClasses.border} bg-ink-900/80` : "border-ink-700 bg-ink-900/40"
      }`}
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? accentClasses.bg : "bg-ink-700"
        }`}
      >
        <motion.span
          animate={{ x: checked ? 20 : 2 }}
          transition={SPRING_SNAPPY}
          className="inline-block h-5 w-5 rounded-full bg-paper shadow"
        />
      </span>
      <span>
        <span className={`block font-display font-semibold uppercase tracking-wide ${checked ? accentClasses.text : "text-paper"}`}>
          {label}
        </span>
        {description && <span className="mt-0.5 block text-xs text-smoke-500">{description}</span>}
      </span>
    </motion.button>
  );
}
