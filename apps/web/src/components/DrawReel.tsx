import { useEffect, useRef } from "react";
import { Button } from "./ui/Button";
import { SlotReel } from "./SlotReel";

export interface ReelCandidate {
  club: string;
  year: number;
}

interface Props {
  /** The winner to land on, decided before the spin starts — undefined only in the idle (not-yet-spun) state. */
  target?: ReelCandidate | undefined;
  leagueName?: string | undefined;
  /** Real candidates for the current pool — the club/season reels spin through these independently. */
  candidates?: ReelCandidate[] | undefined;
  /** Bump this every time a new spin should start (alongside a new `target`). */
  spinToken: number;
  spinning: boolean;
  disabled?: boolean | undefined;
  onSpin: () => void;
  /** Fires once both columns have visually landed on `target`. */
  onSettled?: () => void;
}

export function DrawReel({
  target,
  leagueName,
  candidates,
  spinToken,
  spinning,
  disabled,
  onSpin,
  onSettled,
}: Props) {
  const clubItems = candidates?.length ? candidates.map((c) => c.club) : ["SCANNING", "ARCHIVES", "RECORDS"];
  const yearItems = candidates?.length ? candidates.map((c) => String(c.year)) : ["----", "----", "----"];

  const clubSettled = useRef(false);
  const seasonSettled = useRef(false);

  useEffect(() => {
    clubSettled.current = false;
    seasonSettled.current = false;
  }, [spinToken]);

  function handleClubSettled() {
    clubSettled.current = true;
    if (seasonSettled.current) onSettled?.();
  }
  function handleSeasonSettled() {
    seasonSettled.current = true;
    if (clubSettled.current) onSettled?.();
  }

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
        data-testid="draw-reel-box"
        className={`notch relative border-2 bg-ink-900/70 p-5 transition-colors ${
          spinning ? "border-mint-500/60" : "border-ink-700"
        } ${!disabled && !spinning ? "cursor-pointer" : ""}`}
        // A separate tap target from the "Make the Draw" button below, not a wrapper around it —
        // wrapping the button too would double-fire onSpin from both the button's own click and
        // this div's click bubbling up to it on the same interaction.
        onClick={() => {
          if (!disabled && !spinning) onSpin();
        }}
      >
        {spinning && <span aria-hidden className="absolute inset-0 animate-mint-pulse bg-mint-500/5" />}

        <div className="relative flex items-end gap-3">
          <SlotReel
            label="Club"
            decorativeItems={clubItems}
            winnerLabel={target?.club ?? null}
            spinToken={spinToken}
            spinning={spinning}
            landedClass="text-paper"
            onSettled={handleClubSettled}
          />
          <span className="mb-3 font-display text-lg text-ink-600">&times;</span>
          <SlotReel
            label="Season"
            decorativeItems={yearItems}
            winnerLabel={target ? String(target.year) : null}
            spinToken={spinToken}
            spinning={spinning}
            landedClass="text-mint-400"
            settleDelayMs={200}
            onSettled={handleSeasonSettled}
          />
        </div>

        {!spinning && leagueName && <p className="relative mt-3 text-xs text-smoke-500">{leagueName}</p>}
      </div>

      <div>
        <Button type="button" disabled={disabled || spinning} onClick={onSpin} size="lg" className="mx-auto">
          {spinning ? "Drawing..." : "Make the Draw"}
        </Button>
      </div>
      <p className="text-xs text-ink-600">or tap the reel, or press space</p>
    </div>
  );
}
