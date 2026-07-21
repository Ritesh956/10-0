import confetti from "canvas-confetti";
import { prefersReducedMotion } from "./motion";

/** Locked to the brand palette (tailwind.config.ts) — never free-hand new celebration colors. */
const CELEBRATION_PALETTE = ["#1fbf75", "#3ed98f", "#d69a34", "#e6b559", "#4facc9", "#f4f4f6"];

function burst(opts: confetti.Options) {
  void confetti({ colors: CELEBRATION_PALETTE, disableForReducedMotion: true, ...opts });
}

/** A single modest burst — CL qualification. */
export function fireQualificationBurst() {
  if (prefersReducedMotion()) return;
  burst({ particleCount: 70, spread: 65, startVelocity: 35, origin: { y: 0.6 } });
}

/** A bigger, multi-burst shower — CL champion / title win, the biggest moment in the app. */
export function fireChampionShower() {
  if (prefersReducedMotion()) return;
  const end = Date.now() + 1200;
  (function frame() {
    burst({ particleCount: 4, angle: 60, spread: 60, startVelocity: 45, origin: { x: 0, y: 0.6 } });
    burst({ particleCount: 4, angle: 120, spread: 60, startVelocity: 45, origin: { x: 1, y: 0.6 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  burst({ particleCount: 120, spread: 100, startVelocity: 40, origin: { y: 0.5 } });
}

/** A small celebratory accent — the unbeaten ShareCard ribbon. */
export function fireUnbeatenBurst() {
  if (prefersReducedMotion()) return;
  burst({ particleCount: 50, spread: 55, startVelocity: 30, origin: { y: 0.4 }, scalar: 0.9 });
}

/** A medium burst — winning the domestic title outright (but not unbeaten). */
export function fireTitleBurst() {
  if (prefersReducedMotion()) return;
  burst({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.5 } });
}
