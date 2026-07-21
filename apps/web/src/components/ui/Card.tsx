import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  children: ReactNode;
}

export function Card({ interactive, selected, className = "", children, ...rest }: Props) {
  return (
    <div
      className={`notch border-2 p-5 shadow-lg shadow-black/30 transition ${
        selected
          ? "border-mint-500 bg-mint-500/10 shadow-mint-500/10"
          : "border-ink-700 bg-ink-900/60" + (interactive ? " hover:border-ink-600 hover:shadow-black/50" : "")
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
