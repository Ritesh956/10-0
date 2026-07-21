import { useEffect, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { EASE_DECELERATE, SPRING_BOUNCY } from "../lib/motion";

const ROW_HEIGHT = 48; // px — matches the window's h-12 row slots
const LOOPS = 4; // how many full shuffles of the decorative pool the strip spins through before landing

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildStrip(winnerLabel: string, decorativeLabels: string[]): string[] {
  const pool = decorativeLabels.length ? decorativeLabels : ["—", "—", "—"];
  const strip: string[] = [];
  for (let i = 0; i < LOOPS; i++) strip.push(...shuffle(pool));
  strip.push(winnerLabel);
  return strip;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export interface SlotReelProps {
  label: string;
  /** Decorative candidate labels the strip spins through before landing on `winnerLabel`. */
  decorativeItems: string[];
  /** The true winner to land on — must already be decided before the spin starts. */
  winnerLabel: string | null;
  /** Bump this every time a new spin should run (must change alongside `winnerLabel`). */
  spinToken: number;
  spinning: boolean;
  landedClass?: string;
  /** Extra ms this column holds before its settle stage — staggers columns so they don't stop in lockstep. */
  settleDelayMs?: number;
  /** Fires once this column has visually landed on the winner and held for a reveal beat. */
  onSettled?: () => void;
}

/** One physically-decelerating reel column — drives a slot-machine-style spin down to an exact,
    pre-decided winner, and only reports done once the motion itself has settled (never a bare timer). */
export function SlotReel({
  label,
  decorativeItems,
  winnerLabel,
  spinToken,
  spinning,
  landedClass = "text-paper",
  settleDelayMs = 0,
  onSettled,
}: SlotReelProps) {
  const y = useMotionValue(ROW_HEIGHT);
  const [strip, setStrip] = useState<string[]>(() => (decorativeItems.length ? decorativeItems : ["—"]));
  const [justLanded, setJustLanded] = useState(false);

  // Idle state (before the first spin ever runs) tracks whatever decorative pool comes in.
  useEffect(() => {
    if (!spinning && winnerLabel === null) {
      setStrip(decorativeItems.length ? decorativeItems : ["—"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorativeItems.join("|"), spinning, winnerLabel]);

  useEffect(() => {
    if (!spinning || winnerLabel === null) return;
    setJustLanded(false);

    const built = buildStrip(winnerLabel, decorativeItems);
    setStrip(built);
    const finalIndex = built.length - 1;
    const targetY = ROW_HEIGHT * (1 - finalIndex);
    const approachY = targetY + ROW_HEIGHT * 2.5; // stop a couple rows short — the settle spring covers the rest

    let cancelled = false;
    y.set(ROW_HEIGHT);

    (async () => {
      await animate(y, approachY, { duration: 1.3 + Math.random() * 0.2, ease: EASE_DECELERATE });
      if (cancelled) return;
      if (settleDelayMs) await sleep(settleDelayMs);
      if (cancelled) return;
      await animate(y, targetY, SPRING_BOUNCY);
      if (cancelled) return;
      setJustLanded(true);
      await sleep(450);
      if (cancelled) return;
      onSettled?.();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken, spinning, winnerLabel]);

  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-smoke-600">{label}</p>
      <div className="notch-sm relative mt-2 h-36 overflow-hidden border-2 border-ink-700 bg-ink-950/60">
        <motion.div style={{ y }}>
          {strip.map((item, i) => {
            const isFinal = i === strip.length - 1;
            const revealed = isFinal && justLanded;
            return (
              <motion.p
                key={i}
                animate={revealed ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex h-12 items-center justify-center truncate whitespace-nowrap px-2 text-center font-display text-base font-bold uppercase tracking-tight ${
                  revealed ? landedClass : "text-smoke-500"
                }`}
              >
                {item}
              </motion.p>
            );
          })}
        </motion.div>
        {/* Center-row marker + edge fade — the classic slot-machine window chrome. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/3 h-1/3 border-y-2 border-gold-500/30 bg-gold-500/5" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-950 via-transparent to-ink-950" />
      </div>
    </div>
  );
}
