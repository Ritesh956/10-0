import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`notch-sm border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
        active
          ? "border-gold-500 bg-gold-500/10 text-gold-300"
          : "border-ink-700 text-smoke-500 hover:border-ink-600 hover:text-smoke-400"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
