import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  children: ReactNode;
}

export function Card({ interactive, selected, className = "", children, ...rest }: Props) {
  return (
    <div
      className={`notch border-2 p-5 transition ${
        selected
          ? "border-gold-500 bg-gold-500/10"
          : "border-ink-700 bg-ink-900/60" + (interactive ? " hover:border-ink-600" : "")
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
