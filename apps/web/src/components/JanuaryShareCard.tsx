import type { JanuaryEventType, JanuaryResultDto } from "../api/types";
import { SHARE_COLORS, type ShareCardModel } from "../lib/shareImage";
import { ShareActions } from "./ShareActions";

interface Props {
  outcome: JanuaryResultDto;
}

const EVENT_LABEL: Record<JanuaryEventType, string> = {
  POSITIVE: "Smart Business",
  NEUTRAL: "Lateral Move",
  NEGATIVE: "Costly Gamble",
};

/** The two-way share (38-0 §6g): a second "Share your January" card summarizing the OUT→IN beat,
    alongside ShareCard's "Share your season" — only rendered when a January transfer happened. */
export function JanuaryShareCard({ outcome, clubName }: Props & { clubName?: string | undefined }) {
  const label = outcome.label ?? EVENT_LABEL[outcome.eventType];
  const delta = `${outcome.delta > 0 ? "+" : ""}${outcome.delta} OVR`;
  const shareText = `January Transfer Window (${label}): ${outcome.inPlayer.name} in, ${outcome.outPlayer.name} out (${delta}).`;
  const card: ShareCardModel = {
    kicker: "January transfer window",
    title: clubName ?? label,
    subtitle: label,
    headline: delta,
    headlineColor: outcome.delta > 0 ? SHARE_COLORS.mint : outcome.delta < 0 ? SHARE_COLORS.crimson : SHARE_COLORS.paper,
    stats: [
      { label: "Out", value: String(outcome.outPlayer.overall) },
      { label: "In", value: String(outcome.inPlayer.overall), color: SHARE_COLORS.mint },
    ],
    lines: [`IN  ${outcome.inPlayer.name}`, `OUT  ${outcome.outPlayer.name}`, `${outcome.outPlayer.position} · ${outcome.inPlayer.clubName}`],
    accent: SHARE_COLORS.amber,
  };

  return (
    <div className="notch relative overflow-hidden border-2 border-ink-700 bg-gradient-to-br from-plum-500/10 via-ink-900 to-ink-950 p-8 text-center shadow-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-smoke-600">January Transfer Window</p>
      <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-paper">{label}</h2>
      <p className="mt-2 text-sm text-smoke-400">
        {outcome.inPlayer.name} in &middot; {outcome.outPlayer.name} out
      </p>
      <p className="mt-4 font-display text-2xl font-bold text-paper">
        {outcome.delta > 0 ? "+" : ""}
        {outcome.delta} <span className="text-sm font-normal text-smoke-500">OVR swing</span>
      </p>

      <ShareActions card={card} caption={`${shareText} ${typeof window !== "undefined" ? window.location.origin : ""}`.trim()} fileName="futbol-january.png" />
    </div>
  );
}
