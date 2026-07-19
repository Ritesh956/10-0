import { useEffect, useState } from "react";
import { Button } from "./ui/Button";

interface Props {
  clubName?: string | undefined;
  seasonYear?: number | undefined;
  leagueName?: string | undefined;
  spinning: boolean;
  disabled?: boolean | undefined;
  onSpin: () => void;
}

const SCAN_WORDS = ["SCANNING RECORDS", "CHECKING ARCHIVES", "PULLING A NAME", "LOCKING IN"];

export function DrawReel({ clubName, seasonYear, leagueName, spinning, disabled, onSpin }: Props) {
  const [scanIndex, setScanIndex] = useState(0);

  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setScanIndex((i) => (i + 1) % SCAN_WORDS.length), 220);
    return () => clearInterval(id);
  }, [spinning]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code === "Space" && !disabled && !spinning) {
        e.preventDefault();
        onSpin();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [disabled, spinning, onSpin]);

  return (
    <div className="space-y-5 text-center">
      <div className="notch relative mx-auto max-w-xs border-2 border-ink-700 bg-ink-900/70 px-6 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-smoke-600">The Draw</p>

        <div className="mt-4 h-9 overflow-hidden">
          <p
            className={`font-display text-2xl font-bold uppercase tracking-tight ${
              spinning ? "animate-reel-cycle text-smoke-600" : "text-paper"
            }`}
          >
            {spinning ? SCAN_WORDS[scanIndex] : (clubName ?? "— UNDRAWN —")}
          </p>
        </div>

        {!spinning && leagueName && <p className="mt-1 text-xs text-smoke-500">{leagueName}</p>}

        {seasonYear !== undefined && !spinning && (
          <span className="notch-sm absolute -right-3 -top-3 border-2 border-gold-500 bg-ink-950 px-2.5 py-1 text-xs font-bold text-gold-400">
            {seasonYear}
          </span>
        )}
      </div>

      <div>
        <Button type="button" disabled={disabled || spinning} onClick={onSpin} size="lg" className="mx-auto">
          {spinning ? "Drawing..." : "Make the Draw"}
        </Button>
      </div>
      <p className="text-xs text-ink-600">shortcut: space bar</p>
    </div>
  );
}
