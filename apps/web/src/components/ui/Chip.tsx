import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { SPRING_SNAPPY } from "../../lib/motion";

/** Native props framer-motion's HTMLMotionProps redefines with an incompatible signature
    (drag gestures, its own animation lifecycle) — omitted since Chip never uses them natively. */
type MotionConflictingProps =
  | "style"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onTransitionEnd";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, MotionConflictingProps> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active, className = "", children, ...rest }: Props) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={SPRING_SNAPPY}
      className={`notch-sm border-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
        active
          ? "border-gold-500 bg-gold-500/10 text-gold-300"
          : "border-ink-700 text-smoke-500 hover:border-ink-600 hover:text-smoke-400"
      } ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
