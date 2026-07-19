import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-lg shadow-gold-500/10 disabled:shadow-none",
  outline: "border-2 border-ink-600 text-paper hover:border-gold-500/60 hover:bg-ink-800/60",
  ghost: "text-smoke-500 hover:text-paper hover:bg-ink-800/60",
  danger: "bg-crimson-500 text-paper hover:bg-crimson-400",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`notch-sm inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
