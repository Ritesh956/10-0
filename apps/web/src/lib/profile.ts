import type { CabinetEntryDto, ProfileDto } from "../api/types";
import { SHARE_COLORS, type ShareCardModel } from "./shareImage";
import { TIER_META, TROPHY_CATALOG } from "./trophies";

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

/** The "share your cabinet" image + caption: trophy count up top, career numbers in the tiles,
    and the rarest trophies held (by how few players have them) as the lines. */
export function cabinetShareCard(profile: ProfileDto): { card: ShareCardModel; caption: string } {
  const earned = profile.cabinet.filter((c) => c.count > 0);
  const rarest = sortCabinet(earned, "rarest").slice(0, 5);
  const { stats } = profile;
  const lines = rarest.map((c) => {
    const meta = TROPHY_CATALOG[c.key];
    const rarity = c.rarityPct === null ? "" : ` · ${c.rarityPct}% of players`;
    return `${meta.name} — ${TIER_META[c.tier].label}${rarity}${c.count > 1 ? ` · ×${c.count}` : ""}`;
  });
  if (earned.length > rarest.length) lines.push(`+ ${earned.length - rarest.length} more`);

  const legendary = earned.some((c) => c.tier === "legendary");
  const card: ShareCardModel = {
    kicker: "Trophy cabinet",
    title: profile.user.displayName,
    subtitle: `${stats.seasonsFinished} season${stats.seasonsFinished === 1 ? "" : "s"} · ${stats.titles} title${stats.titles === 1 ? "" : "s"}`,
    headline: `${earned.length} / ${profile.cabinet.length}`,
    headlineColor: SHARE_COLORS.amber,
    stats: [
      { label: "Titles", value: String(stats.titles), color: SHARE_COLORS.amber },
      { label: "Win rate", value: stats.winRate === null ? "—" : `${Math.round(stats.winRate * 100)}%` },
      { label: "Best pts", value: stats.bestPoints ? String(stats.bestPoints.value) : "—" },
      { label: "Unbeaten", value: String(stats.unbeatenSeasons), color: SHARE_COLORS.mint },
    ],
    lines,
    accent: SHARE_COLORS.amber,
    ...(legendary ? { ribbon: "Legendary" } : {}),
  };
  const top = rarest[0] ? ` Rarest: ${TROPHY_CATALOG[rarest[0].key].name}.` : "";
  const caption = `My Futbol trophy cabinet: ${earned.length} of ${profile.cabinet.length} trophies, ${stats.titles} title${stats.titles === 1 ? "" : "s"}.${top} Can you beat it?`;
  return { card, caption };
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

/** Titles won in each of the five leagues, from the finished runs (a run is a title when it
    finished first or earned "champions"). Every league is listed, with 0 where nothing's been won,
    so the profile can show the five-league collection and how far it is from complete. */
export function titlesByLeague(runs: { leagueId: string | null; finished: boolean; position: number | null; trophies: string[] }[]): {
  leagueId: string;
  titles: number;
}[] {
  const ids = ["league-gb1", "league-es1", "league-it1", "league-l1", "league-fr1"];
  const counts = new Map(ids.map((id) => [id, 0]));
  for (const run of runs) {
    if (!run.finished || !run.leagueId || !counts.has(run.leagueId)) continue;
    if (run.position === 1 || run.trophies.includes("champions")) counts.set(run.leagueId, counts.get(run.leagueId)! + 1);
  }
  return ids.map((leagueId) => ({ leagueId, titles: counts.get(leagueId)! }));
}
