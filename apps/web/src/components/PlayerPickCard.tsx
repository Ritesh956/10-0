import type { PlayerSeasonDto } from "../api/types";
import { POSITION_GROUP, type Position } from "../lib/formations";
import { GROUP_FILL, GROUP_TEXT, GROUP_TINT } from "../lib/positionColors";

interface Props {
  player: PlayerSeasonDto;
  showRatings: boolean;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  muted?: boolean | undefined;
  tag?: string | undefined;
  onClick?: (() => void) | undefined;
}

const TAG_TONE: Record<string, string> = {
  recommended: "border-gold-500/40 bg-gold-500/10 text-gold-300",
  "already in your XI": "border-ink-700 bg-ink-800 text-smoke-500",
};

export function PlayerPickCard({ player, showRatings, selected, disabled, muted, tag, onClick }: Props) {
  const primaryGroup = POSITION_GROUP[(player.positions[0] as Position) ?? "CM"];
  const tagTone = tag ? (TAG_TONE[tag] ?? "border-crimson-500/30 bg-crimson-500/10 text-crimson-300") : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`notch-sm flex w-full items-center gap-3 border-2 px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-gold-500 bg-gold-500/10"
          : "border-ink-700 bg-ink-900/40 hover:border-ink-600 hover:bg-ink-900/70"
      } ${muted ? "opacity-60" : ""}`}
    >
      {player.player.photoUrl ? (
        <span className="relative h-11 w-11 shrink-0">
          <img
            src={player.player.photoUrl}
            alt=""
            loading="lazy"
            className="notch-sm h-11 w-11 border border-ink-700 object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {showRatings && (
            <span
              className={`notch-sm absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center px-0.5 font-display text-[10px] font-bold text-ink-950 ${GROUP_FILL[primaryGroup]}`}
            >
              {player.overall}
            </span>
          )}
        </span>
      ) : showRatings ? (
        <span
          className={`notch-sm flex h-11 w-11 shrink-0 items-center justify-center font-display text-sm font-bold text-ink-950 ${GROUP_FILL[primaryGroup]}`}
        >
          {player.overall}
        </span>
      ) : (
        <span className="notch-sm flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink-700 bg-ink-800 text-smoke-500">
          ?
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-paper">{player.player.name}</span>
        <span className="block truncate text-xs text-smoke-500">{player.player.nationality}</span>
      </span>

      {tag && (
        <span className={`notch-sm shrink-0 border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${tagTone}`}>
          {tag}
        </span>
      )}

      <span className="flex shrink-0 gap-1">
        {player.positions.map((pos) => {
          const group = POSITION_GROUP[pos as Position] ?? "MID";
          return (
            <span
              key={pos}
              className={`notch-sm px-1.5 py-0.5 text-[10px] font-bold ${GROUP_TINT[group]} ${GROUP_TEXT[group]}`}
            >
              {pos}
            </span>
          );
        })}
      </span>
    </button>
  );
}
