import type { CabinetEntryDto } from "../api/types";
import { TIER_META } from "./trophies";

export type CabinetSort = "catalogue" | "rarest" | "earned";

/** Rarest first goes by how few players hold it (then tier); earned first keeps catalogue order
    within each half. The cabinet arrives in catalogue order. */
export function sortCabinet(entries: CabinetEntryDto[], sort: CabinetSort): CabinetEntryDto[] {
  if (sort === "catalogue") return entries;
  const indexed = entries.map((entry, i) => ({ entry, i }));
  if (sort === "earned") {
    return indexed
      .sort((a, b) => Number(b.entry.count > 0) - Number(a.entry.count > 0) || a.i - b.i)
      .map((x) => x.entry);
  }
  return indexed
    .sort(
      (a, b) =>
        (a.entry.rarityPct ?? 0) - (b.entry.rarityPct ?? 0) ||
        TIER_META[b.entry.tier].order - TIER_META[a.entry.tier].order ||
        a.i - b.i,
    )
    .map((x) => x.entry);
}

/** Week number since the epoch, Monday-based, so every player sees the same highlight all week. */
export function weekIndex(date: Date): number {
  const days = Math.floor(date.getTime() / 86_400_000);
  return Math.floor((days + 3) / 7); // 1970-01-01 was a Thursday
}

/** "Trophy of the week": a locked trophy you can set out to win in a single run (not a career
    milestone or a mode-specific one), rotating weekly. Null once every candidate is earned. */
export function weeklyTrophy(cabinet: CabinetEntryDto[], date: Date): CabinetEntryDto | null {
  const candidates = cabinet.filter(
    (c) => c.count === 0 && (c.category === "squad" || c.category === "season" || c.category === "fun"),
  );
  if (candidates.length === 0) return null;
  return candidates[weekIndex(date) % candidates.length] ?? null;
}

const ORDINAL_SUFFIX = ["th", "st", "nd", "rd"];
export function ordinal(n: number): string {
  const v = n % 100;
  return `${n}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? ORDINAL_SUFFIX[0]}`;
}

/** "4 Oct 2026" — day-first and unambiguous, unlike the browser's US default. */
export function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
