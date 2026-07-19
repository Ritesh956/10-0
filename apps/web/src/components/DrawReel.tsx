import { useEffect } from "react";
import { Button } from "./ui/Button";

export interface ReelCandidate {
  club: string;
  year: number;
}

interface Props {
  clubName?: string | undefined;
  seasonYear?: number | undefined;
  leagueName?: string | undefined;
  /** Real candidates for the current pool — the club/season reels spin through these independently. */
  candidates?: ReelCandidate[] | undefined;
  spinning: boolean;
  disabled?: boolean | undefined;
  onSpin: () => void;
}

/** One spinning (or landed) column — shared by the Club and Season reels. */
function ReelColumn({
  label,
  items,
  landedValue,
  landedClass = "text-paper",
  spinning,
}: {
  label: string;
  items: string[];
  landedValue: string;
  landedClass?: string;
  spinning: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-smoke-600">{label}</p>
      <div
        className={`notch-sm relative mt-2 h-12 overflow-hidden border-2 bg-ink-950/60 transition-colors ${
          spinning ? "border-gold-500/50" : "border-ink-700"
        }`}
      >
        {spinning ? (
          <div className="animate-reel-scroll blur-[0.5px]">
            {[...items, ...items].map((item, i) => (
              <p
                key={i}
                className="flex h-12 items-center justify-center truncate whitespace-nowrap px-2 font-display text-base font-bold uppercase tracking-tight text-smoke-500"
              >
                {item}
              </p>
            ))}
          </div>
        ) : (
          <p
            className={`animate-pop-in flex h-12 items-center justify-center truncate whitespace-nowrap px-2 text-center font-display text-base font-bold uppercase tracking-tight ${landedClass}`}
          >
            {landedValue}
          </p>
        )}
      </div>
    </div>
  );
}

export function DrawReel({ clubName, seasonYear, leagueName, candidates, spinning, disabled, onSpin }: Props) {
  const clubItems = candidates?.length ? candidates.map((c) => c.club) : ["SCANNING", "ARCHIVES", "RECORDS"];
  const yearItems = candidates?.length ? candidates.map((c) => String(c.year)) : ["----", "----", "----"];

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
    <div className="mx-auto max-w-sm space-y-5 text-center">
      <div
        className={`notch relative border-2 bg-ink-900/70 p-5 transition-colors ${
          spinning ? "border-gold-500/60" : "border-ink-700"
        }`}
      >
        {spinning && <span aria-hidden className="absolute inset-0 animate-gold-pulse bg-gold-500/5" />}

        <div className="relative flex items-end gap-3">
          <ReelColumn label="Club" items={clubItems} landedValue={clubName ?? "— UNDRAWN —"} spinning={spinning} />
          <span className="mb-3 font-display text-lg text-ink-600">&times;</span>
          <ReelColumn
            label="Season"
            items={yearItems}
            landedValue={seasonYear !== undefined ? String(seasonYear) : "—"}
            landedClass="text-gold-400"
            spinning={spinning}
          />
        </div>

        {!spinning && leagueName && <p className="relative mt-3 text-xs text-smoke-500">{leagueName}</p>}
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
