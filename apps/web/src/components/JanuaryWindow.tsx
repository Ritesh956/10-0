import { CountryFlag } from "./CountryFlag";
import { useState } from "react";
import { motion } from "framer-motion";
import type { JanuaryEventType, JanuaryOfferDto, JanuaryResultDto, MatchSummaryDto } from "../api/types";
import { DrawReel } from "./DrawReel";
import { SlotReel } from "./SlotReel";
import { Button } from "./ui/Button";
import { accumulateRecord } from "../lib/matchResult";
import { staggerContainer, staggerItem, staggerItemBounce } from "../lib/motion";
import { formatSeason } from "../lib/season";

type Step = "choice" | "event-reel" | "event" | "spinning" | "result";

interface Props {
  /** The user's own first-half fixtures — used only to render the halfway recap tiles/on-pace line. */
  matches: MatchSummaryDto[];
  userClubId: string;
  totalMatchdays: number;
  matchdaysPlayed: number;
  /** The user's league position at the halfway mark, and the league's size, when known. */
  tablePosition?: number | undefined;
  leagueSize?: number | undefined;
  /** Fetches this season's January event (the same every time). Without it the window goes straight
      to a single blind signing, the pre-event-layer behaviour. */
  onOffer?: (() => Promise<JanuaryOfferDto>) | undefined;
  /** Resolves the deal on the backend (persisted swap). `choiceId` picks one of a choice event's offers. */
  onResolve: (choiceId?: string) => Promise<JanuaryResultDto>;
  /** null = declined ("Stick with your XI"); otherwise the resolved outcome, once the player has seen it. */
  onDone: (outcome: JanuaryResultDto | null) => void;
}

const EVENT_PANEL_CLASS: Record<JanuaryEventType, string> = {
  POSITIVE: "border-mint-400/60 bg-gradient-to-br from-mint-500/15 via-ink-900 to-ink-950",
  NEUTRAL: "border-ink-700 bg-gradient-to-br from-ink-800/40 via-ink-900 to-ink-950",
  NEGATIVE: "border-crimson-400/60 bg-gradient-to-br from-crimson-500/15 via-ink-900 to-ink-950",
};
const VERDICT: Record<JanuaryEventType, string> = {
  POSITIVE: "Smart business",
  NEUTRAL: "A sideways move",
  NEGATIVE: "That one hurt",
};
const EVENT_DELTA_COLOR: Record<JanuaryEventType, string> = {
  POSITIVE: "text-mint-400",
  NEUTRAL: "text-smoke-400",
  NEGATIVE: "text-crimson-400",
};
const EVENT_ICON: Record<JanuaryEventType, string> = { POSITIVE: "🤝", NEUTRAL: "🔄", NEGATIVE: "⚠️" };

/** Decorative names the event reel spins through before landing on the real one. */
const EVENT_REEL_LABELS = ["Bargain Buy", "Wheeler Dealer", "Deadline Day Panic", "Loan Swap", "Star Wants Out"];

const ORDINAL_SUFFIX = ["th", "st", "nd", "rd"];
function ordinal(n: number): string {
  const v = n % 100;
  return `${n}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? ORDINAL_SUFFIX[0]}`;
}

/** The halfway-pause mechanic (38-0's January Transfer Window): a first-half recap, then — if the
    player enters the market — an event-type reel ("Working the phones…") that lands on one of five
    named events, each with its own mechanic (january.logic.ts JANUARY_KINDS): a blind signing for
    the weakest slot, three blind offers to choose from, a random starter swapped on deadline day, a
    loan from another league, or the best player sold. The outcome can genuinely help or hurt. */
export function JanuaryWindow({
  matches,
  userClubId,
  totalMatchdays,
  matchdaysPlayed,
  tablePosition,
  leagueSize,
  onOffer,
  onResolve,
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>("choice");
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<JanuaryOfferDto | null>(null);
  const [eventSpinToken, setEventSpinToken] = useState(0);
  const [spinToken, setSpinToken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<JanuaryResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const record = accumulateRecord(matches, userClubId);
  const goalDiff = record.goalsFor - record.goalsAgainst;
  const projectedPoints = matchdaysPlayed > 0 ? Math.round((record.points / matchdaysPlayed) * totalMatchdays) : 0;

  function fail(err: unknown) {
    setSpinning(false);
    setBusy(false);
    setStep("choice");
    setError(err instanceof Error ? err.message : "Couldn't reach the transfer market — try again.");
  }

  async function enterMarket() {
    setError(null);
    if (!onOffer) return void makeDeal();
    setBusy(true);
    try {
      const o = await onOffer();
      setOffer(o);
      setStep("event-reel");
      setEventSpinToken((t) => t + 1);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  /** A single-draw event: resolve, then spin the club × season reel to the signing. */
  async function makeDeal() {
    setError(null);
    setStep("spinning");
    setSpinning(true);
    try {
      const outcome = await onResolve();
      setResult(outcome);
      setSpinToken((t) => t + 1);
    } catch (err) {
      fail(err);
    }
  }

  /** A choice event: the club and season are already on the card, so the signing is revealed directly. */
  async function signOption(choiceId: string) {
    setError(null);
    setBusy(true);
    try {
      setResult(await onResolve(choiceId));
      setStep("result");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (step === "result" && result) {
    return (
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className={`notch space-y-4 border-2 p-6 text-center sm:p-8 ${EVENT_PANEL_CLASS[result.eventType]}`}
      >
        <motion.p variants={staggerItemBounce} className="text-3xl">
          {EVENT_ICON[result.eventType]}
        </motion.p>
        <motion.p variants={staggerItem} className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-500">
          Done Deal &middot; {result.outPlayer.position}
          {result.label ? ` · ${result.label}` : ""}
        </motion.p>
        <motion.h2 variants={staggerItem} className="font-display text-lg font-bold uppercase tracking-wide text-paper">
          {VERDICT[result.eventType]}
        </motion.h2>
        <motion.div variants={staggerItem} className="flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <p className="text-[10px] uppercase tracking-wide text-smoke-500">Out</p>
            <p className="font-display text-base font-semibold text-paper">{result.outPlayer.name}</p>
            <p className="text-xs text-smoke-500">OVR {result.outPlayer.overall}</p>
          </div>
          <span className="text-xl text-ink-600">&rarr;</span>
          <div className="flex-1 text-left">
            <p className="text-[10px] uppercase tracking-wide text-smoke-500">In</p>
            <p className="font-display text-base font-semibold text-paper">{result.inPlayer.name}</p>
            <p className="text-xs text-smoke-500">
              OVR {result.inPlayer.overall} &middot; {result.inPlayer.clubName} {formatSeason(result.inPlayer.seasonYear)}
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
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="notch space-y-5 border border-ink-800 bg-ink-900/50 p-5 sm:p-6">
      <motion.div variants={staggerItem} className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">January Transfer Window</p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-paper">Halfway there</h2>
      </motion.div>

      <motion.div variants={staggerItem} className="notch grid grid-cols-4 gap-2 border border-ink-800 bg-ink-950/40 p-3 text-center">
        {[
          { value: record.won, label: "Won", cls: "text-mint-400" },
          { value: record.drawn, label: "Drawn", cls: "text-paper" },
          { value: record.lost, label: "Lost", cls: "text-crimson-400" },
          { value: record.points, label: "Pts", cls: "text-paper" },
        ].map((t) => (
          <div key={t.label}>
            <p className={`font-display text-lg font-bold ${t.cls}`}>{t.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-smoke-500">{t.label}</p>
          </div>
        ))}
      </motion.div>

      <motion.p variants={staggerItem} className="text-center text-sm text-smoke-400">
        {tablePosition !== undefined && (
          <>
            You&apos;re <span className="font-semibold text-paper">{ordinal(tablePosition)}</span>
            {leagueSize ? ` of ${leagueSize}` : ""}, goal difference{" "}
            <span className="font-semibold text-paper">
              {goalDiff >= 0 ? "+" : ""}
              {goalDiff}
            </span>
            .{" "}
          </>
        )}
        At this pace you&apos;re on course for <span className="font-semibold text-paper">{projectedPoints} points</span> by the
        end of the season.
      </motion.p>

      {step === "event-reel" && offer ? (
        <div className="notch border-2 border-amber-500/40 bg-ink-900/70 p-5 text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-amber-300/80">Working the phones…</p>
          <SlotReel
            label="January event"
            decorativeItems={EVENT_REEL_LABELS}
            winnerLabel={offer.label}
            spinToken={eventSpinToken}
            spinning
            onSettled={() => setStep("event")}
          />
        </div>
      ) : step === "event" && offer ? (
        <motion.div variants={staggerItem} className="notch space-y-4 border-2 border-amber-500/40 bg-amber-500/5 p-5">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-amber-300/80">January event</p>
            <h3 className="flex items-center justify-center gap-2 font-display text-xl font-bold uppercase tracking-wide text-paper">
              {offer.league && <CountryFlag country={offer.league.country} className="h-4 w-6" />}
              {offer.label}
            </h3>
            <p className="mt-1 text-sm text-smoke-400">{offer.premise}</p>
            <p className="mt-2 text-xs text-smoke-500">
              On the line: <span className="font-semibold text-paper">{offer.outPlayer.name}</span> ({offer.outPlayer.position}, OVR{" "}
              {offer.outPlayer.overall})
            </p>
          </div>
          {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
          {offer.options ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {offer.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void signOption(o.id)}
                  className="notch-sm border border-ink-700 bg-ink-900/70 p-3 text-left transition hover:border-amber-400/60 disabled:opacity-50"
                >
                  <p className="font-semibold text-paper">{o.name}</p>
                  <p className="text-xs text-smoke-500">
                    {o.clubName} {formatSeason(o.seasonYear)} · {o.position}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-amber-300/80">OVR ?? · Sign</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <Button variant="gamble" onClick={() => void makeDeal()}>
                Make the call
              </Button>
            </div>
          )}
        </motion.div>
      ) : step === "spinning" ? (
        <DrawReel
          target={result ? { club: result.inPlayer.clubName, year: result.inPlayer.seasonYear } : undefined}
          spinToken={spinToken}
          spinning={spinning}
          disabled
          onSpin={() => {}}
          onSettled={() => {
            setSpinning(false);
            setStep("result");
          }}
        />
      ) : (
        <motion.div variants={staggerItem} className="space-y-3">
          {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="gamble" disabled={busy} onClick={() => void enterMarket()}>
              Enter the Transfer Market
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => onDone(null)}>
              Stick with your XI
            </Button>
          </div>
          <p className="text-center text-xs text-smoke-500">One event, no undo. It can strengthen your squad, or leave it worse off.</p>
        </motion.div>
      )}
    </motion.div>
  );
}
