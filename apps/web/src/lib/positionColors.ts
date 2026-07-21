import type { PositionGroup } from "./formations";

/** Shared group→color maps so pitch markers, avatars, and position pills stay consistent.
    GK=amber, DEF=teal(blue), MID=mint(green), ATT=crimson(red) — a keeper/defence/midfield/attack
    mapping, not tied to the app's primary-accent color, so a position marker never gets confused
    for a primary CTA even though mint is used for both. */
export const GROUP_FILL: Record<PositionGroup, string> = {
  GK: "bg-amber-400",
  DEF: "bg-teal-400",
  MID: "bg-mint-400",
  ATT: "bg-crimson-400",
};

export const GROUP_TINT: Record<PositionGroup, string> = {
  GK: "bg-amber-500/25",
  DEF: "bg-teal-500/25",
  MID: "bg-mint-500/25",
  ATT: "bg-crimson-500/25",
};

export const GROUP_TEXT: Record<PositionGroup, string> = {
  GK: "text-amber-300",
  DEF: "text-teal-300",
  MID: "text-mint-300",
  ATT: "text-crimson-300",
};

export const GROUP_HALO: Record<PositionGroup, string> = {
  GK: "bg-amber-300",
  DEF: "bg-teal-300",
  MID: "bg-mint-300",
  ATT: "bg-crimson-300",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
