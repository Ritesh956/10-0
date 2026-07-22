import { useState } from "react";
import { motion } from "framer-motion";
import type { JanuaryEventType, JanuaryResultDto, MatchSummaryDto } from "../api/types";
import { DrawReel } from "./DrawReel";
import { Button } from "./ui/Button";
import { accumulateRecord } from "../lib/matchResult";
import { staggerContainer, staggerItem, staggerItemBounce } from "../lib/motion";

type Step = "choice" | "spinning" | "result";

interface Props {
  /** The user's own first-half fixtures — used only to render the halfway recap tiles/on-pace line. */
  matches: MatchSummaryDto[];
  userClubId: string;
  totalMatchdays: number;
  matchdaysPlayed: number;
  /** Calls the backend to resolve the gamble (weakest slot, drawn replacement, persisted swap). */
  onResolve: () => Promise<JanuaryResultDto>;
  /** null = declined ("Stick with your XI"); otherwise the resolved outcome, once the player has seen it. */
  onDone: (outcome: JanuaryResultDto | null) => void;
}

const EVENT_PANEL_CLASS: Record<JanuaryEventType, string> = {
  POSITIVE: "border-mint-400/60 bg-gradient-to-br from-mint-500/15 via-ink-900 to-ink-950",
  NEUTRAL: "border-ink-700 bg-gradient-to-br from-ink-800/40 via-ink-900 to-ink-950",
  NEGATIVE: "border-crimson-400/60 bg-gradient-to-br from-crimson-500/15 via-ink-900 to-ink-950",
};
const EVENT_LABEL: Record<JanuaryEventType, string> = {
  POSITIVE: "Smart Business",
  NEUTRAL: "Lateral Move",
  NEGATIVE: "Costly Gamble",
};
const EVENT_DELTA_COLOR: Record<JanuaryEventType, string> = {
  POSITIVE: "text-mint-400",
  NEUTRAL: "text-smoke-400",
  NEGATIVE: "text-crimson-400",
};
const EVENT_ICON: Record<JanuaryEventType, string> = { POSITIVE: "🤝", NEUTRAL: "🔄", NEGATIVE: "⚠️" };

/** The halfway-pause mechanic: a recap of the first-half record, a choice between gambling on a
    replacement for the squad's weakest slot or sticking with the XI, and — if gambling — a
    DrawReel-driven CLUB × SEASON spin resolving into a "Done Deal" OUT→IN card. Mirrors 38-0's
    January Transfer Window (plan §8): the outcome can genuinely help or hurt, styled mint/crimson
    to match the app's existing "good news" vs "danger" conventions (see SeasonPage's europe-
    transition/champion panels) rather than importing 38-0's own color language. */
export function JanuaryWindow({ matches, userClubId, totalMatchdays, matchdaysPlayed, onResolve, onDone }: Props) {
  const [step, setStep] = useState<Step>("choice");
  const [spinToken, setSpinToken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<JanuaryResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const record = accumulateRecord(matches, userClubId);
  const projectedPoints = matchdaysPlayed > 0 ? Math.round((record.points / matchdaysPlayed) * totalMatchdays) : 0;

  async function handleGamble() {
    setError(null);
    setStep("spinning");
    setSpinning(true);
    try {
      const outcome = await onResolve();
      setResult(outcome);
      setSpinToken((t) => t + 1);
    } catch (err) {
      setSpinning(false);
      setStep("choice");
      setError(err instanceof Error ? err.message : "Couldn't reach the transfer market — try again.");
    }
  }

  function handleSettled() {
    setSpinning(false);
    setStep("result");
  }

  if (step === "result" && result) {
    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className={`notch space-y-4 border-2 p-8 text-center ${EVENT_PANEL_CLASS[result.eventType]}`}
      >
        <motion.p variants={staggerItemBounce} className="text-3xl">
          {EVENT_ICON[result.eventType]}
        </motion.p>
        <motion.p variants={staggerItem} className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">
          Done Deal &middot; {result.outPlayer.position}
        </motion.p>
        <motion.h2 variants={staggerItem} className="font-display text-lg font-bold uppercase tracking-wide text-paper">
          {EVENT_LABEL[result.eventType]}
        </motion.h2>
        <motion.div variants={staggerItem} className="flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <p className="text-[10px] uppercase tracking-wide text-smoke-600">Out</p>
            <p className="font-display text-base font-semibold text-paper">{result.outPlayer.name}</p>
            <p className="text-xs text-smoke-500">OVR {result.outPlayer.overall}</p>
          </div>
          <span className="text-xl text-ink-600">&rarr;</span>
          <div className="flex-1 text-left">
            <p className="text-[10px] uppercase tracking-wide text-smoke-600">In</p>
            <p className="font-display text-base font-semibold text-paper">{result.inPlayer.name}</p>
            <p className="text-xs text-smoke-500">
              OVR {result.inPlayer.overall} &middot; {result.inPlayer.clubName} {result.inPlayer.seasonYear}
            </p>
          </div>
        </motion.div>
        <motion.p variants={staggerItem} className={`font-display text-2xl font-bold ${EVENT_DELTA_COLOR[result.eventType]}`}>
          {result.delta > 0 ? "+" : ""}
          {result.delta} OVR
        </motion.p>
        <motion.div variants={staggerItem}>
          <Button onClick={() => onDone(result)}>Continue the season &rarr;</Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="notch space-y-5 border border-ink-800 bg-ink-900/50 p-6"
    >
      <motion.div variants={staggerItem} className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">January Transfer Window</p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-paper">Halfway there</h2>
      </motion.div>

      <motion.div variants={staggerItem} className="notch grid grid-cols-4 gap-2 border border-ink-800 bg-ink-950/40 p-3 text-center">
        <div>
          <p className="font-display text-lg font-bold text-teal-400">{record.won}</p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Won</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-paper">{record.drawn}</p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Drawn</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-crimson-400">{record.lost}</p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Lost</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-mint-400">{record.points}</p>
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Pts</p>
        </div>
      </motion.div>

      <motion.p variants={staggerItem} className="text-center text-sm text-smoke-400">
        At this pace you&apos;re on course for <span className="font-semibold text-paper">{projectedPoints} points</span> by the
        end of the season.
      </motion.p>

      {step === "spinning" ? (
        <DrawReel
          target={result ? { club: result.inPlayer.clubName, year: result.inPlayer.seasonYear } : undefined}
          spinToken={spinToken}
          spinning={spinning}
          disabled
          onSpin={() => {}}
          onSettled={handleSettled}
        />
      ) : (
        <motion.div variants={staggerItem} className="space-y-3">
          {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="danger" onClick={() => void handleGamble()}>
              Enter the Transfer Market
            </Button>
            <Button variant="outline" onClick={() => onDone(null)}>
              Stick with your XI
            </Button>
          </div>
          <p className="text-center text-xs text-ink-600">A gamble can strengthen your squad — or leave it worse off.</p>
        </motion.div>
      )}
    </motion.div>
  );
}
