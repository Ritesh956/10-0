/** Squad-tier flavor names (38-0 §9): maps a squad's overall rating to a narrative-flavor band,
    surfaced on the draft-complete screen and the end-of-season results. Reuses the app's existing
    accent palette (amber/mint/teal/plum/crimson, smoke for the neutral middle band) rather than
    inventing new tier-specific colors — the same reuse-don't-invent approach as positionColors.ts. */

export type SquadTier = "Galácticos" | "Elite" | "Strong" | "Mid-table" | "Budget" | "Minnows";

const TIER_BANDS: { min: number; tier: SquadTier }[] = [
  { min: 88, tier: "Galácticos" },
  { min: 82, tier: "Elite" },
  { min: 76, tier: "Strong" },
  { min: 68, tier: "Mid-table" },
  { min: 60, tier: "Budget" },
  { min: 0, tier: "Minnows" },
];

export function squadTierName(overall: number): SquadTier {
  return TIER_BANDS.find((b) => overall >= b.min)!.tier;
}

export const TIER_TEXT: Record<SquadTier, string> = {
  Galácticos: "text-amber-300",
  Elite: "text-mint-300",
  Strong: "text-teal-300",
  "Mid-table": "text-smoke-300",
  Budget: "text-plum-300",
  Minnows: "text-crimson-300",
};

export const TIER_BORDER: Record<SquadTier, string> = {
  Galácticos: "border-amber-400/60",
  Elite: "border-mint-400/60",
  Strong: "border-teal-400/50",
  "Mid-table": "border-ink-600",
  Budget: "border-plum-400/50",
  Minnows: "border-crimson-400/50",
};
