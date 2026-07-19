import type { PositionGroup } from "./formations";

/** Shared group→color maps so pitch markers, avatars, and position pills stay consistent. */
export const GROUP_FILL: Record<PositionGroup, string> = {
  GK: "bg-plum-400",
  DEF: "bg-gold-400",
  MID: "bg-teal-400",
  ATT: "bg-crimson-400",
};

export const GROUP_TINT: Record<PositionGroup, string> = {
  GK: "bg-plum-500/25",
  DEF: "bg-gold-500/25",
  MID: "bg-teal-500/25",
  ATT: "bg-crimson-500/25",
};

export const GROUP_TEXT: Record<PositionGroup, string> = {
  GK: "text-plum-300",
  DEF: "text-gold-300",
  MID: "text-teal-300",
  ATT: "text-crimson-300",
};

export const GROUP_HALO: Record<PositionGroup, string> = {
  GK: "bg-plum-300",
  DEF: "bg-gold-300",
  MID: "bg-teal-300",
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
