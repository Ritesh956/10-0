import type { JanuaryEventType, JanuaryResultDto } from "../api/types";

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
export function JanuaryShareCard({ outcome }: Props) {
  const shareText = `January Transfer Window: ${outcome.inPlayer.name} in, ${outcome.outPlayer.name} out (${
    outcome.delta > 0 ? "+" : ""
  }${outcome.delta} OVR) — ${EVENT_LABEL[outcome.eventType]}.`;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(shareText);
  }

  return (
    <div className="notch relative overflow-hidden border-2 border-ink-700 bg-gradient-to-br from-plum-500/10 via-ink-900 to-ink-950 p-8 text-center shadow-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-smoke-600">January Transfer Window</p>
      <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-paper">{EVENT_LABEL[outcome.eventType]}</h2>
      <p className="mt-2 text-sm text-smoke-400">
        {outcome.inPlayer.name} in &middot; {outcome.outPlayer.name} out
      </p>
      <p className="mt-4 font-display text-2xl font-bold text-paper">
        {outcome.delta > 0 ? "+" : ""}
        {outcome.delta} <span className="text-sm font-normal text-smoke-500">OVR swing</span>
      </p>

      <button
        onClick={() => void copyToClipboard()}
        className="notch-sm mt-8 border-2 border-paper bg-paper px-5 py-2 text-sm font-display font-semibold uppercase tracking-wide text-ink-950 transition hover:border-mint-300 hover:bg-mint-300"
      >
        Copy January result to share
      </button>
    </div>
  );
}
