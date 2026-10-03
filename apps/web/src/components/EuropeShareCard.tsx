import type { KnockoutRound, KnockoutTieDto } from "../api/types";
import { SHARE_COLORS, type ShareCardModel } from "../lib/shareImage";
import { ShareActions } from "./ShareActions";

interface Props {
  clubName: string;
  userClubId: string;
  champion: boolean;
  championName: string;
  ties: KnockoutTieDto[];
}

const ROUND_ORDER: KnockoutRound[] = ["QF", "SF", "FINAL"];
const ROUND_NAME: Record<KnockoutRound, string> = { QF: "quarter-final", SF: "semi-final", FINAL: "final" };

/** How far the user's club went: the furthest knockout round it played, and whether it won it. */
export function europeRun(ties: KnockoutTieDto[], userClubId: string): { round: KnockoutRound; won: boolean } | null {
  const mine = ties.filter((t) => t.homeClubId === userClubId || t.awayClubId === userClubId);
  if (mine.length === 0) return null;
  const furthest = mine.reduce((a, b) => (ROUND_ORDER.indexOf(b.round) > ROUND_ORDER.indexOf(a.round) ? b : a));
  return { round: furthest.round, won: furthest.winnerClubId === userClubId };
}

/** The third share moment (38-0 has one per competition): the European Nights campaign. */
export function EuropeShareCard({ clubName, userClubId, champion, championName, ties }: Props) {
  const run = europeRun(ties, userClubId);
  const headline = champion ? "European champions" : run ? `Out in the ${ROUND_NAME[run.round]}` : "European Nights";
  const card: ShareCardModel = {
    kicker: "European Nights",
    title: clubName,
    headline,
    headlineColor: champion ? SHARE_COLORS.amber : SHARE_COLORS.paper,
    stats: [],
    lines: champion ? ["Kings of Europe"] : [`Winners: ${championName}`],
    accent: champion ? SHARE_COLORS.amber : SHARE_COLORS.teal,
    ...(champion ? { ribbon: "Champions" } : {}),
  };
  const caption = `${clubName} — European Nights: ${headline.toLowerCase()}. ${typeof window !== "undefined" ? window.location.origin : ""}`.trim();

  return (
    <div className="notch border-2 border-ink-700 bg-gradient-to-br from-teal-500/10 via-ink-900 to-ink-950 p-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-smoke-500">European Nights</p>
      <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-paper">{headline}</h2>
      <ShareActions card={card} caption={caption} fileName="futbol-europe.png" />
    </div>
  );
}
