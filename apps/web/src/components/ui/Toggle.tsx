export type ToggleAccent = "gold" | "teal" | "crimson";

interface Props {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  accent?: ToggleAccent;
}

const ACCENT_CLASSES: Record<ToggleAccent, { border: string; bg: string; text: string }> = {
  gold: { border: "border-gold-500/50", bg: "bg-gold-500", text: "text-gold-400" },
  teal: { border: "border-teal-500/50", bg: "bg-teal-500", text: "text-teal-400" },
  crimson: { border: "border-crimson-500/50", bg: "bg-crimson-500", text: "text-crimson-400" },
};

export function Toggle({ label, description, checked, onChange, accent = "gold" }: Props) {
  const accentClasses = ACCENT_CLASSES[accent];
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`notch-sm flex w-full items-center gap-4 border-2 p-4 text-left transition ${
        checked ? `${accentClasses.border} bg-ink-900/80` : "border-ink-700 bg-ink-900/40"
      }`}
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center transition ${
          checked ? accentClasses.bg : "bg-ink-700"
        }`}
        style={{ clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}
      >
        <span
          className={`inline-block h-5 w-5 -translate-y-0 transform bg-paper shadow transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
          style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
        />
      </span>
      <span>
        <span className={`block font-display font-semibold uppercase tracking-wide ${checked ? accentClasses.text : "text-paper"}`}>
          {label}
        </span>
        {description && <span className="mt-0.5 block text-xs text-smoke-500">{description}</span>}
      </span>
    </button>
  );
}
