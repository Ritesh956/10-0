import type { PlayerSeasonDto } from "../api/types";
import type { Position, PositionGroup } from "../lib/formations";
import { GROUP_FILL, GROUP_TEXT, GROUP_TINT } from "../lib/positionColors";

interface Props {
  position: Position;
  group: PositionGroup;
  player: PlayerSeasonDto;
  showRatings: boolean;
}

export function DraftedPlayerRow({ position, group, player, showRatings }: Props) {
  return (
    <div className="notch-sm flex items-center gap-3 bg-ink-900/50 px-3 py-2.5">
      <span
        className={`notch-sm shrink-0 px-2 py-1 text-[10px] font-bold ${GROUP_TINT[group]} ${GROUP_TEXT[group]}`}
      >
        {position}
      </span>
      {player.player.photoUrl && (
        <img
          src={player.player.photoUrl}
          alt=""
          loading="lazy"
          className="notch-sm h-8 w-8 shrink-0 object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-paper">{player.player.name}</span>
        <span className="block truncate text-xs text-smoke-500">{player.player.nationality}</span>
      </span>
      <span className="shrink-0 text-right text-xs text-smoke-500">
        {player.clubSeason.club.name} <span className="text-smoke-600">{player.seasonYear}</span>
      </span>
      {showRatings && (
        <span
          className={`notch-sm shrink-0 px-1.5 py-0.5 font-display text-xs font-bold text-ink-950 ${GROUP_FILL[group]}`}
        >
          {player.overall}
        </span>
      )}
    </div>
  );
}
