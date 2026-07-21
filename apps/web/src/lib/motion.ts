import type { Transition, Variants } from "framer-motion";

/** Shared motion tokens — mirrors the centralized-token pattern in positionColors.ts,
    so any component reaches for these instead of hand-rolling ad hoc durations/easings. */

/** Steep-in, long-tail-out cubic bezier — the "winding down" feel for a reel's spin stage. */
export const EASE_DECELERATE = [0.12, 0.85, 0.35, 1] as const;

/** Stiff, low-damping spring for immediate feedback: button taps, toggles. */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 500, damping: 30, mass: 0.8 };

/** Lower stiffness with a visible overshoot — celebratory pop-ins, a reel settling into place. */
export const SPRING_BOUNCY: Transition = { type: "spring", stiffness: 300, damping: 12, mass: 0.9 };

/** Critically-damped-ish, no overshoot — page transitions, panel reveals. */
export const SPRING_SMOOTH: Transition = { type: "spring", stiffness: 260, damping: 28, mass: 1 };

/** Mirrors the CSS `pop-in` keyframe (opacity 0→1, scale 0.92→1, y 6→0) for components
    migrating off the Tailwind animation onto Framer variants. */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: SPRING_SMOOTH },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.15 } },
};

/** Staggers a group of children in one after another — list/table reveals, celebration copy. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: SPRING_SMOOTH },
};

/** Same as staggerItem but scales in with an overshoot — trophy/emoji accents inside a stagger. */
export const staggerItemBounce: Variants = {
  initial: { opacity: 0, scale: 0.4 },
  animate: { opacity: 1, scale: 1, transition: SPRING_BOUNCY },
};

/** Short cross-fade + slight vertical drift — page-route transitions. Kept brief (~150-200ms)
    so it reads as polish, not friction, on a SPA with frequent navigation. */
export const fadeSlide: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.14, ease: "easeIn" } },
};

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
