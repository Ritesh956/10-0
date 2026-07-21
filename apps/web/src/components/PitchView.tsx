import { useState } from "react";
import { type Formation, POSITION_GROUP, positionLabel, slotsForFormation } from "../lib/formations";
import { GROUP_FILL, GROUP_HALO, GROUP_TINT, initials } from "../lib/positionColors";

export interface PitchSlotState {
  filled?: { name: string; overall?: number; photoUrl?: string | null };
  ineligible?: boolean;
}

/** Shows the player's photo when it loads, falling back to initials only if there's no photo or it fails to load. */
function MarkerFace({ name, photoUrl }: { name: string; photoUrl?: string | null | undefined }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  if (showPhoto) {
    return (
      <img
        src={photoUrl!}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setPhotoFailed(true)}
      />
    );
  }
  return <span className="relative">{initials(name)}</span>;
}

interface Props {
  formation: Formation;
  /** Keyed by slot index (order matches slotsForFormation). */
  slotState?: Record<number, PitchSlotState> | undefined;
  activeSlotIndex?: number | undefined;
  showRatings?: boolean | undefined;
  onSlotClick?: ((index: number) => void) | undefined;
  compact?: boolean | undefined;
}

const MARKER_SHAPE = { borderRadius: "9999px" };

export function PitchView({ formation, slotState = {}, activeSlotIndex, showRatings = true, onSlotClick, compact }: Props) {
  const slots = slotsForFormation(formation);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border-2 border-grass-600/60 bg-gradient-to-b from-grass-700 via-grass-800 to-grass-900 shadow-inner shadow-black/40">
      {/* pitch markings */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-paper/15" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/15"
        style={{ width: "6%", aspectRatio: "1 / 1" }}
      />
      <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-paper/15" />
      <div className="absolute left-1/2 top-[8%] h-[16%] w-[46%] -translate-x-1/2 border border-paper/15" />
      <div className="absolute bottom-0 left-1/2 h-[16%] w-[46%] -translate-x-1/2 border border-paper/15" />
      <div className="absolute left-1/2 top-[8%] h-[6%] w-[22%] -translate-x-1/2 border border-paper/10" />
      <div className="absolute bottom-0 left-1/2 h-[6%] w-[22%] -translate-x-1/2 border border-paper/10" />

      {slots.map((slot, index) => {
        const state = slotState[index];
        const group = POSITION_GROUP[slot.position];
        const active = activeSlotIndex === index;
        const markerSize = compact ? "h-8 w-8 text-[9px]" : "h-10 w-10 text-[10px]";

        return (
          <button
            key={index}
            type="button"
            disabled={!onSlotClick}
            onClick={() => onSlotClick?.(index)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <span className="relative flex items-center justify-center">
              {active && (
                <span
                  aria-hidden
                  className={`absolute -inset-1.5 animate-pulse ${GROUP_HALO[group]}`}
                  style={MARKER_SHAPE}
                />
              )}
              <span
                style={MARKER_SHAPE}
                className={`relative flex items-center justify-center overflow-hidden font-display font-bold transition ${markerSize} ${
                  state?.ineligible
                    ? "bg-ink-700 text-smoke-500"
                    : state?.filled
                      ? `${GROUP_FILL[group]} text-ink-950`
                      : `${GROUP_TINT[group]} text-paper`
                }`}
              >
                {state?.filled ? (
                  <MarkerFace name={state.filled.name} photoUrl={state.filled.photoUrl} />
                ) : (
                  <span className="relative">{slot.position}</span>
                )}
              </span>
            </span>
            {!compact && (
              <span className="notch-sm bg-ink-950/70 px-1.5 py-0.5 text-[10px] leading-tight text-smoke-400">
                {state?.filled ? (
                  <>
                    <span className="block max-w-[72px] truncate font-medium text-paper">{state.filled.name}</span>
                    {showRatings && state.filled.overall !== undefined && (
                      <span className="block text-center text-mint-400">{state.filled.overall}</span>
                    )}
                  </>
                ) : (
                  positionLabel(slot.position)
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
