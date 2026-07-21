import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type { ClubSeasonDto, ManagerDto, PlayerSeasonDto } from "../api/types";
import { DraftedPlayerRow } from "../components/DraftedPlayerRow";
import { DrawReel, type ReelCandidate } from "../components/DrawReel";
import { GuestGateModal } from "../components/GuestGateModal";
import { PitchView, type PitchSlotState } from "../components/PitchView";
import { PlayerPickCard } from "../components/PlayerPickCard";
import { SlotReel } from "../components/SlotReel";
import { Button } from "../components/ui/Button";
import { RatingBar } from "../components/ui/RatingBar";
import { SPRING_SMOOTH } from "../lib/motion";
import {
  canPlayPosition,
  POSITION_GROUP,
  positionLabel,
  slotsForFormation,
  type Position,
  type PositionGroup,
} from "../lib/formations";
import { isRealCountry } from "../lib/leagues";
import { surname } from "../lib/positionColors";
import { useAuth } from "../lib/auth-context";
import { useDraft } from "../state/DraftContext";

type SortMode = "rating" | "position" | "surname";
type PostDraftStep = "review" | "manager" | "preseason";

const GROUP_ORDER: Record<PositionGroup, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

const TACTICS_LABELS: Record<string, string> = {
  "very-defensive": "Very Defensive",
  defensive: "Defensive",
  balanced: "Balanced",
  attacking: "Attacking",
  "very-attacking": "Very Attacking",
  slow: "Slow Tempo",
  fast: "Fast Tempo",
  narrow: "Narrow",
  wide: "Wide",
  low: "Low Press",
  medium: "Medium Press",
  high: "High Press",
  short: "Short Passing",
  mixed: "Mixed Passing",
  direct: "Direct Passing",
};

function tacticsBadges(manager: ManagerDto): string[] {
  return [manager.mentality, manager.tempo, manager.width, manager.pressing, manager.passingStyle].map(
    (v) => TACTICS_LABELS[v] ?? v,
  );
}

const ORDINAL_SUFFIX = ["th", "st", "nd", "rd"];
function ordinal(n: number): string {
  const v = n % 100;
  return `${n}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? ORDINAL_SUFFIX[0]}`;
}

/** A shuffled sample of real candidate club-seasons to spin through in the draw reel. */
function sampleReelCandidates(pool: ClubSeasonDto[], count = 14): ReelCandidate[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((cs) => ({ club: cs.club.name, year: cs.seasonYear }));
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

export interface PreseasonOdds {
  seasonSize: number;
  expectedPoints: number;
  winPct: number;
  top4Pct: number;
  relegationPct: number;
  projectedFinish: number;
}

/** Pre-season projection shown on the confirm screen. Every stat is derived from ONE continuous
    expected-finish position (via a logistic rank distribution) rather than separate hand-tuned
    curves per stat — those used to disagree with each other (e.g. a squad "projected 7th" could
    simultaneously show ~40% to win the league, which makes no sense together). */
export function computePreseasonOdds(overallRating: number): PreseasonOdds {
  // SEASON_SIZE mirrors the real top-flight-sized league SeasonPage actually simulates
  // (see apps/web/src/pages/SeasonPage.tsx's createSeason call) — keep the two in sync.
  const seasonSize = 20;
  const matches = (seasonSize - 1) * 2;
  // A hard 55-90 clamp saturated `strength` to 1 for almost any good squad (overall 90+
  // is common), making every strong draft show the same "90% to win it" numbers. A logistic
  // curve centered on a realistic "mid-table top-flight XI" benchmark keeps differentiating
  // squads all the way up near the top of the rating scale instead of flatlining early.
  const MID_OVERALL = 75;
  const SPREAD = 8;
  const strength = 1 / (1 + Math.exp(-(overallRating - MID_OVERALL) / SPREAD));
  const ppg = 0.6 + strength * 2; // ~0.6 (relegation form) to ~2.6 (title-winning pace) points/game

  const meanRank = seasonSize - strength * (seasonSize - 1); // continuous, e.g. ~6.6 for a strong-but-not-dominant XI
  const RANK_SPREAD = 3.5; // typical +/- finish-position swing a team of given quality sees season to season
  const LOGISTIC_SCALE = RANK_SPREAD / 1.814; // logistic-distribution scale matching that spread's std dev
  const rankCdf = (threshold: number) => 1 / (1 + Math.exp((meanRank - threshold) / LOGISTIC_SCALE));

  return {
    seasonSize,
    expectedPoints: Math.round(ppg * matches),
    winPct: Math.max(1, Math.min(95, Math.round(rankCdf(1) * 100))),
    top4Pct: Math.max(1, Math.min(99, Math.round(rankCdf(4) * 100))),
    relegationPct: Math.max(0, Math.min(90, Math.round((1 - rankCdf(seasonSize - 3)) * 100))),
    projectedFinish: Math.max(1, Math.min(seasonSize, Math.round(meanRank))),
  };
}

function sortPlayers(list: PlayerSeasonDto[], mode: SortMode): PlayerSeasonDto[] {
  const copy = [...list];
  if (mode === "rating") {
    copy.sort((a, b) => b.overall - a.overall);
  } else if (mode === "position") {
    copy.sort((a, b) => {
      const groupA = POSITION_GROUP[(a.positions[0] as Position) ?? "CM"];
      const groupB = POSITION_GROUP[(b.positions[0] as Position) ?? "CM"];
      return GROUP_ORDER[groupA] - GROUP_ORDER[groupB] || b.overall - a.overall;
    });
  } else {
    copy.sort((a, b) => surname(a.player.name).localeCompare(surname(b.player.name)));
  }
  return copy;
}

function OddsBar({ label, pct, colorClass }: { label: string; pct: number; colorClass: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-smoke-500">{label}</span>
        <span className="font-display font-bold text-paper">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-ink-800">
        <motion.div
          className={`h-full ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={SPRING_SMOOTH}
        />
      </div>
    </div>
  );
}

export function DraftPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const {
    config,
    picks,
    addPick,
    removePick,
    resetDraft,
    rerollsRemaining,
    useReroll,
    squadName,
    setSquadName,
    setWorldId,
  } = useDraft();
  // Untouched squadName defaults to the user's own name instead of a generic placeholder —
  // falls back further to "My Fantasy XI" only for the rare case of no signed-in display name.
  const effectiveSquadName = squadName || user?.displayName || "My Fantasy XI";

  const slots = slotsForFormation(config.formation);
  const filledCount = Object.keys(picks).length;
  const allFilled = filledCount >= slots.length;

  // When exactly one slot remains, surface it as the obvious next pick instead of making the
  // user hunt for it — highlighted on the pitch, auto-targeted, and bumped to the top of the pool.
  const emptySlotIndices = slots.map((_, i) => i).filter((i) => !(i in picks));
  const recommendedSlotIndex = emptySlotIndices.length === 1 ? emptySlotIndices[0]! : null;
  // The full set of positions still open across the XI — a player who can't fill any of these
  // can never be used this draft, regardless of how many slots remain.
  const remainingPositions = [...new Set(emptySlotIndices.map((i) => slots[i]!.position))];
  function isUsableAnywhere(player: PlayerSeasonDto): boolean {
    return remainingPositions.some((pos) => canPlayPosition(player.positions, pos));
  }

  const [pool, setPool] = useState<ClubSeasonDto[] | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);

  const [currentClub, setCurrentClub] = useState<ClubSeasonDto | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinTarget, setSpinTarget] = useState<ReelCandidate | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const spinSettleResolveRef = useRef<(() => void) | null>(null);
  const [reelCandidates, setReelCandidates] = useState<ReelCandidate[]>([]);
  const [playerPool, setPlayerPool] = useState<PlayerSeasonDto[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<PlayerSeasonDto | null>(null);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("rating");

  const [moveMode, setMoveMode] = useState(false);
  const [moveSourceIndex, setMoveSourceIndex] = useState<number | null>(null);

  const [postDraftStep, setPostDraftStep] = useState<PostDraftStep>("review");
  const [managerPick, setManagerPick] = useState<ManagerDto | null>(null);
  const [spinningManager, setSpinningManager] = useState(false);
  const [managerCandidates, setManagerCandidates] = useState<string[]>([]);
  const [managerSpinTarget, setManagerSpinTarget] = useState<string | null>(null);
  const [managerSpinToken, setManagerSpinToken] = useState(0);
  const managerSettleResolveRef = useRef<(() => void) | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!config.eraId) {
      navigate("/setup");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.listClubSeasons({ eraId: config.eraId, leagueIds: config.leagueIds });
        const filtered = raw.filter(
          (cs) =>
            cs.seasonYear >= (config.eraYearMin ?? 0) &&
            cs.seasonYear <= (config.eraYearMax ?? 9999) &&
            isRealCountry(cs.club.country),
        );
        if (!cancelled) setPool(filtered);
      } catch (err) {
        if (!cancelled) setPoolError(err instanceof Error ? err.message : "Failed to load club seasons");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.eraId, config.leagueIds.join(","), config.eraYearMin, config.eraYearMax]);

  async function loadPlayersFor(club: ClubSeasonDto): Promise<PlayerSeasonDto[] | null> {
    setLoadingPlayers(true);
    try {
      const players = await api.listPlayerSeasons({ clubSeasonId: club.id, ratingsMode: config.playerRatings });
      setPlayerPool(players);
      return players;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load players");
      return null;
    } finally {
      setLoadingPlayers(false);
    }
  }

  function handleSpinSettled() {
    spinSettleResolveRef.current?.();
    spinSettleResolveRef.current = null;
  }

  // A drawn club whose entire pool has nobody eligible for the slot(s) still open would
  // otherwise deadlock the user — nobody to pick, but no redraw left to escape it either.
  // Cap how many consecutive free auto-rerolls we'll silently burn through so a pathologically
  // narrow filtered pool (every club in it missing the needed position) can't loop forever.
  const MAX_AUTO_REROLL_ATTEMPTS = 8;

  async function doSpin(excludeIds?: Set<string>, autoRerollAttempt = 0) {
    if (!pool || pool.length === 0) {
      setError("No club seasons match your league and era filters — go back and widen them.");
      return;
    }
    setError(null);
    setPendingPlayer(null);
    setPlayerPool([]);
    const candidates = excludeIds && excludeIds.size > 0 ? pool.filter((cs) => !excludeIds.has(cs.id)) : pool;
    const source = candidates.length > 0 ? candidates : pool;
    // Decide the winner up front so the reel animates deterministically to a known target
    // instead of freezing after an arbitrary delay and revealing the answer afterwards.
    const club = source[Math.floor(Math.random() * source.length)]!;
    setReelCandidates(sampleReelCandidates(source));
    setSpinTarget({ club: club.club.name, year: club.seasonYear });
    setSpinToken((t) => t + 1);
    setSpinning(true);
    await new Promise<void>((resolve) => {
      spinSettleResolveRef.current = resolve;
    });
    setCurrentClub(club);
    setSpinning(false);
    const players = await loadPlayersFor(club);
    if (players === null) return; // load failed — error already surfaced, nothing more to do here

    const usable = effectiveSlot
      ? players.some((p) => canPlayPosition(p.positions, effectiveSlot.position))
      : players.some((p) => isUsableAnywhere(p));

    if (!usable) {
      if (autoRerollAttempt >= MAX_AUTO_REROLL_ATTEMPTS) {
        setError(
          "None of the last several draws had anyone who could fill this slot — try widening your league or era filters.",
        );
        return;
      }
      const nextExcluded = new Set(excludeIds);
      nextExcluded.add(club.id);
      await doSpin(nextExcluded, autoRerollAttempt + 1);
    }
  }

  function handleReroll() {
    if (rerollsRemaining <= 0 || !currentClub) return;
    useReroll();
    void doSpin(new Set([currentClub.id]));
  }

  useEffect(() => {
    if (postDraftStep !== "manager") return;
    let cancelled = false;
    void api
      .listManagers()
      .then((managers) => {
        if (!cancelled) setManagerCandidates(managers.map((m) => m.name));
      })
      .catch(() => {
        // decorative-only — a failed prefetch just falls back to the SlotReel's own placeholder
      });
    return () => {
      cancelled = true;
    };
  }, [postDraftStep]);

  function handleManagerSpinSettled() {
    managerSettleResolveRef.current?.();
    managerSettleResolveRef.current = null;
  }

  async function doManagerSpin() {
    setSpinningManager(true);
    setError(null);
    try {
      const manager = await api.rollManager();
      setManagerSpinTarget(manager.name);
      setManagerSpinToken((t) => t + 1);
      await new Promise<void>((resolve) => {
        managerSettleResolveRef.current = resolve;
      });
      setManagerPick(manager);
      setPostDraftStep("preseason");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draw a gaffer");
    } finally {
      setSpinningManager(false);
    }
  }

  function resetSpinState() {
    setCurrentClub(null);
    setPlayerPool([]);
    setPendingPlayer(null);
    setTargetSlotIndex(null);
  }

  function assignPlayer(slotIndex: number, player: PlayerSeasonDto) {
    addPick(slotIndex, player);
    resetSpinState();
  }

  /** Only assigns if the player is actually eligible for the slot; otherwise surfaces an error. */
  function tryAssignPlayer(slotIndex: number, player: PlayerSeasonDto): boolean {
    const slot = slots[slotIndex];
    if (!slot || !canPlayPosition(player.positions, slot.position)) {
      setError(
        `${player.player.name} can't play ${slot ? positionLabel(slot.position) : ""} (${slot?.position ?? ""}).`,
      );
      return false;
    }
    setError(null);
    assignPlayer(slotIndex, player);
    return true;
  }

  function handlePlayerClick(player: PlayerSeasonDto) {
    if (Object.values(picks).some((p) => p.id === player.id)) return; // already in the XI
    if (config.draftMode === "position-first" && effectiveTargetIndex !== null) {
      tryAssignPlayer(effectiveTargetIndex, player);
    } else if (config.draftMode === "squad-first" && recommendedSlotIndex !== null) {
      // Only one slot left — skip the extra "choose a position" tap when the player fits it.
      if (!tryAssignPlayer(recommendedSlotIndex, player)) setPendingPlayer(player);
    } else {
      setPendingPlayer(player);
    }
  }

  function handlePitchSlotClick(index: number) {
    if (moveMode) {
      if (picks[index]) {
        setMoveSourceIndex(index === moveSourceIndex ? null : index);
      } else if (moveSourceIndex !== null) {
        const movingPlayer = picks[moveSourceIndex];
        const slot = slots[index];
        if (movingPlayer && slot && canPlayPosition(movingPlayer.positions, slot.position)) {
          removePick(moveSourceIndex);
          addPick(index, movingPlayer);
          setError(null);
        } else if (movingPlayer) {
          setError(`${movingPlayer.player.name} can't play ${slot ? positionLabel(slot.position) : ""} there.`);
        }
        setMoveSourceIndex(null);
        setMoveMode(false);
      }
      return;
    }
    if (picks[index]) return; // slot already filled
    if (config.draftMode === "squad-first" && pendingPlayer) {
      tryAssignPlayer(index, pendingPlayer);
    } else if (config.draftMode === "position-first" && !currentClub && !spinning) {
      setTargetSlotIndex(index);
    }
  }

  async function doConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const world = await api.createWorld(config.eraId);
      setWorldId(world.id);
      const refPlayerSeasonIds = slots.map((_, i) => picks[i]?.id).filter((id): id is string => Boolean(id));
      await api.draftFantasy(world.id, effectiveSquadName, config.formation, refPlayerSeasonIds, managerPick?.id);
      navigate("/season");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm your XI");
    } finally {
      setConfirming(false);
    }
  }

  function handleConfirmClick() {
    if (!isAuthenticated) {
      setShowGuestGate(true);
      return;
    }
    void doConfirm();
  }

  const movingPlayer = moveMode && moveSourceIndex !== null ? picks[moveSourceIndex] : null;

  const slotState: Record<number, PitchSlotState> = {};
  slots.forEach((slot, i) => {
    const player = picks[i];
    slotState[i] = player
      ? { filled: { name: player.player.name, overall: player.overall, photoUrl: player.player.photoUrl } }
      : {
          ineligible: pendingPlayer
            ? !canPlayPosition(pendingPlayer.positions, slot.position)
            : movingPlayer
              ? !canPlayPosition(movingPlayer.positions, slot.position)
              : false,
        };
  });

  // In position-first mode, auto-target the last remaining slot instead of making the user click it.
  const effectiveTargetIndex = targetSlotIndex ?? (config.draftMode === "position-first" ? recommendedSlotIndex : null);
  const targetSlot = effectiveTargetIndex !== null ? slots[effectiveTargetIndex] : null;
  const recommendedSlot = recommendedSlotIndex !== null ? slots[recommendedSlotIndex] : null;
  // Squad-first has no explicit target slot until the very last one is left — that's the recommendation.
  const effectiveSlot = targetSlot ?? (config.draftMode === "squad-first" ? recommendedSlot : null);

  const sortedPlayerPool = useMemo(() => {
    const sorted = sortPlayers(playerPool, sortMode);
    if (effectiveSlot) {
      // A single known target (last slot left, or position-first's drawn slot) — bring fits to the top.
      const compatible = sorted.filter((p) => canPlayPosition(p.positions, effectiveSlot.position));
      const rest = sorted.filter((p) => !canPlayPosition(p.positions, effectiveSlot.position));
      return [...compatible, ...rest];
    }
    // Multiple slots still open — a player only needs to fit *one* of them, but anyone who fits
    // none of the remaining slots can never be used this draft, so sink them to the bottom.
    const usable = sorted.filter((p) => isUsableAnywhere(p));
    const unusable = sorted.filter((p) => !isUsableAnywhere(p));
    return [...usable, ...unusable];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPool, sortMode, effectiveSlot, picks]);

  const draftedIds = useMemo(() => new Set(Object.values(picks).map((p) => p.id)), [picks]);

  const groupOveralls = useMemo(() => {
    const groups: Record<PositionGroup, number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
    slots.forEach((slot, i) => {
      const p = picks[i];
      if (p) groups[POSITION_GROUP[slot.position]].push(p.overall);
    });
    return groups;
  }, [slots, picks]);

  const squadRatings = useMemo(
    () => ({
      attack: average(groupOveralls.ATT),
      midfield: average(groupOveralls.MID),
      defence: average(groupOveralls.DEF),
      gk: average(groupOveralls.GK),
    }),
    [groupOveralls],
  );

  const overallRating = useMemo(() => average(Object.values(picks).map((p) => p.overall)), [picks]);

  const odds = useMemo(() => computePreseasonOdds(overallRating), [overallRating]);

  const pitchClickable = moveMode
    ? handlePitchSlotClick
    : allFilled
      ? undefined
      : config.draftMode === "squad-first"
        ? (pendingPlayer ? handlePitchSlotClick : undefined)
        : (!currentClub && !spinning ? handlePitchSlotClick : undefined);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 border-b border-ink-800 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="notch-sm inline-flex items-center gap-2 border-2 border-mint-500/30 bg-mint-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
              Building your XI
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold uppercase leading-tight tracking-tight text-paper sm:text-4xl">
              Draft Room
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="group hover:border-crimson-500/60 hover:text-crimson-300"
            onClick={() => {
              resetDraft();
              resetSpinState();
              setMoveMode(false);
              setMoveSourceIndex(null);
              setPostDraftStep("review");
              setManagerPick(null);
            }}
          >
            <span className="inline-block transition-transform duration-300 group-hover:-rotate-180">&#8635;</span>
            Restart run
          </Button>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
          <div className="notch-sm border-2 border-teal-500/25 bg-ink-900/40 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Formation</dt>
            <dd className="font-display text-lg font-bold text-teal-400">{config.formation}</dd>
          </div>
          <div className="notch-sm border-2 border-mint-500/25 bg-ink-900/40 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Filled</dt>
            <dd className="font-display text-lg font-bold text-mint-400">
              {filledCount}
              <span className="text-smoke-500">/{slots.length}</span>
            </dd>
          </div>
          <div className="notch-sm border-2 border-plum-500/25 bg-ink-900/40 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Redraws</dt>
            <dd className="font-display text-lg font-bold text-plum-400">{rerollsRemaining}</dd>
          </div>
        </dl>
      </div>

      {(error || poolError) && (
        <div className="notch mb-6 flex items-start gap-3 border-2 border-crimson-500/40 bg-crimson-500/10 p-4">
          <span className="notch-sm flex h-6 w-6 shrink-0 items-center justify-center border border-crimson-500/40 bg-crimson-500/10 text-xs font-bold text-crimson-300">
            !
          </span>
          <p className="text-sm text-crimson-300">{error ?? poolError}</p>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <PitchView
            formation={config.formation}
            slotState={slotState}
            activeSlotIndex={(moveMode ? moveSourceIndex : effectiveTargetIndex) ?? recommendedSlotIndex ?? undefined}
            showRatings={config.showRatings}
            onSlotClick={pitchClickable}
          />
          <Button
            variant="outline"
            size="sm"
            fullWidth
            disabled={filledCount === 0}
            className="mt-3"
            onClick={() => {
              setMoveMode((v) => !v);
              setMoveSourceIndex(null);
            }}
          >
            &#8646; {moveMode ? "Cancel move" : "Move a player"}
          </Button>
          <p className="mt-1 text-center text-xs text-ink-600">Reposition a drafted player to open up a slot.</p>

          <div className="notch-sm mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 border border-ink-800 bg-ink-900/30 px-3 py-2 text-[10px] text-smoke-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-plum-400" /> Keeper
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-mint-400" /> Defence
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-teal-400" /> Midfield
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-crimson-400" /> Attack
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ink-700" /> Can&apos;t play there
            </span>
          </div>

          {allFilled && config.showRatings && (
            <div className="notch mt-4 space-y-3 border border-ink-800 bg-ink-900/50 p-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-smoke-600">Overall</p>
                <p className="font-display text-3xl font-bold text-paper">{overallRating}</p>
              </div>
              <RatingBar label="Attack" value={squadRatings.attack} colorClass="bg-crimson-400" />
              <RatingBar label="Midfield" value={squadRatings.midfield} colorClass="bg-teal-400" />
              <RatingBar label="Defence" value={squadRatings.defence} colorClass="bg-mint-400" />
              <RatingBar label="Goalkeeping" value={squadRatings.gk} colorClass="bg-plum-400" />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {moveMode ? (
            <div className="notch border-2 border-dashed border-ink-700 p-8 text-center text-sm text-smoke-500">
              {moveSourceIndex === null
                ? "Tap a filled position on the pitch to pick them up."
                : "Now tap an empty position to drop them in."}
            </div>
          ) : allFilled ? (
            postDraftStep === "review" ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-mint-400">Squad complete</p>
                  <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-paper">Your XI</h2>
                  <p className="text-sm text-smoke-500">
                    {config.formation} &middot; Overall {overallRating}
                  </p>
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin pr-1">
                  {slots.map((slot, i) => {
                    const player = picks[i];
                    if (!player) return null;
                    return (
                      <DraftedPlayerRow
                        key={i}
                        position={slot.position}
                        group={POSITION_GROUP[slot.position]}
                        player={player}
                        showRatings={config.showRatings}
                      />
                    );
                  })}
                </div>
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => setPostDraftStep(config.managers ? "manager" : "preseason")}
                >
                  Continue &rarr;
                </Button>
              </div>
            ) : postDraftStep === "manager" ? (
              <div className="notch space-y-4 border border-ink-800 bg-ink-900/50 p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">Optional</p>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-paper">Add a manager?</h2>
                <p className="text-sm text-smoke-500">
                  A real manager's tactical identity changes how your team actually plays &mdash; and its odds.
                </p>
                <div
                  className={`notch relative mx-auto max-w-xs border-2 bg-ink-900/70 p-5 transition-colors ${
                    spinningManager ? "border-mint-500/60" : "border-ink-700"
                  }`}
                >
                  {spinningManager && <span aria-hidden className="absolute inset-0 animate-mint-pulse bg-mint-500/5" />}
                  <SlotReel
                    label="Manager"
                    decorativeItems={managerCandidates}
                    winnerLabel={managerSpinTarget}
                    spinToken={managerSpinToken}
                    spinning={spinningManager}
                    onSettled={handleManagerSpinSettled}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" fullWidth disabled={spinningManager} onClick={() => void doManagerSpin()}>
                    {spinningManager ? "Drawing..." : "Draw a gaffer"}
                  </Button>
                  <Button
                    variant="ghost"
                    fullWidth
                    disabled={spinningManager}
                    onClick={() => {
                      setManagerPick(null);
                      setPostDraftStep("preseason");
                    }}
                  >
                    No manager (classic)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-mint-400">Squad Complete</p>
                  <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-paper">
                    {managerPick ? `Under ${managerPick.name}` : "Ready for kickoff"}
                  </h2>
                  <p className="mt-2 text-sm text-smoke-500">
                    Here&apos;s what the numbers say. Simulate the season to see if you beat it.
                  </p>
                </div>

                {managerPick && (
                  <div className="notch space-y-3 border border-ink-800 bg-ink-900/60 p-5 text-left">
                    <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">
                      {managerPick.nationality}
                    </p>
                    {managerPick.philosophy && <p className="text-sm text-smoke-400">{managerPick.philosophy}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {tacticsBadges(managerPick).map((label) => (
                        <span
                          key={label}
                          className="notch-sm border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-400"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="notch space-y-4 border-2 border-mint-500/25 bg-gradient-to-br from-mint-500/[0.06] via-ink-900/60 to-ink-900/60 p-5 text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">Pre-season projection</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase text-smoke-600">Projected finish</p>
                      <p className="font-display text-2xl font-bold text-paper">
                        {ordinal(odds.projectedFinish)}{" "}
                        <span className="text-sm text-smoke-500">/ {odds.seasonSize}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-smoke-600">Expected points</p>
                      <p className="font-display text-2xl font-bold text-mint-400">{odds.expectedPoints}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-ink-800 pt-3">
                    <OddsBar label="Win the league" pct={odds.winPct} colorClass="bg-mint-400" />
                    <OddsBar label="Top 4 (Europe)" pct={odds.top4Pct} colorClass="bg-teal-400" />
                    <OddsBar label="Relegation" pct={odds.relegationPct} colorClass="bg-crimson-400" />
                  </div>
                  <p className="text-xs text-ink-600">
                    What an Overall {overallRating} squad should produce. Simulate to see if you beat it.
                  </p>
                </div>

                <input
                  value={effectiveSquadName}
                  onChange={(e) => setSquadName(e.target.value)}
                  className="notch-sm w-full border border-ink-800 bg-ink-950 px-3 py-2 text-center text-sm text-paper outline-none focus:border-mint-500"
                  placeholder="Name your XI"
                />

                <Button size="lg" fullWidth disabled={confirming} onClick={handleConfirmClick}>
                  {confirming ? "Setting up..." : "Simulate Season →"}
                </Button>
              </div>
            )
          ) : config.draftMode === "position-first" && !currentClub && !spinning ? (
            targetSlot ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-smoke-500">
                  Drawing for your{" "}
                  <span className="font-semibold text-paper">{positionLabel(targetSlot.position)}</span> (
                  {targetSlot.position})
                </p>
                <DrawReel
                  target={spinTarget ?? undefined}
                  spinToken={spinToken}
                  spinning={spinning}
                  candidates={reelCandidates}
                  onSpin={() => void doSpin()}
                  onSettled={handleSpinSettled}
                />
              </div>
            ) : (
              <div className="notch border-2 border-dashed border-ink-700 p-8 text-center text-sm text-smoke-500">
                Click an empty position on the pitch to begin.
              </div>
            )
          ) : currentClub || spinning ? (
            <div className="space-y-4">
              {spinning || !currentClub ? (
                <DrawReel
                  target={spinTarget ?? undefined}
                  leagueName={currentClub?.league.name}
                  candidates={reelCandidates}
                  spinToken={spinToken}
                  spinning={spinning}
                  disabled
                  onSpin={() => void doSpin()}
                  onSettled={handleSpinSettled}
                />
              ) : (
                <div className="notch border border-ink-800 bg-ink-900/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="notch-sm border border-mint-500/40 bg-mint-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-mint-400">
                        Squad Drawn
                      </span>
                      <span
                        className={`notch-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                          config.playerRatings === "prime"
                            ? "border-plum-500/40 bg-plum-500/10 text-plum-300"
                            : "border-ink-700 bg-ink-800 text-smoke-400"
                        }`}
                      >
                        {config.playerRatings === "prime" ? "Prime" : "Season"}
                      </span>
                      <span className="text-xs text-smoke-500">{slots.length - filledCount} slots left</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rerollsRemaining <= 0}
                      className={rerollsRemaining > 0 ? "border-mint-500/50 text-mint-300 hover:border-mint-400" : ""}
                      onClick={handleReroll}
                    >
                      &#8635; Redraw ({rerollsRemaining} left)
                    </Button>
                  </div>
                  <div className="mt-3 border-t border-ink-800 pt-3">
                    <p className="font-display text-xl font-bold uppercase tracking-wide text-paper">
                      {currentClub.club.name} <span className="text-mint-400">{currentClub.seasonYear}</span>
                    </p>
                    <p className="text-xs text-smoke-500">{currentClub.league.name}</p>
                  </div>
                </div>
              )}

              {!spinning && currentClub && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-smoke-500">
                      {pendingPlayer ? (
                        <>
                          Choose a position for{" "}
                          <span className="font-semibold text-paper">{pendingPlayer.player.name}</span>
                        </>
                      ) : (
                        "Pick any player, then choose their position."
                      )}
                    </p>
                    <div className="notch-sm flex shrink-0 items-center gap-0.5 border border-ink-700 bg-ink-900/40 p-0.5 text-[11px] uppercase tracking-wide">
                      {(["rating", "position", "surname"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSortMode(mode)}
                          className={`notch-sm px-2.5 py-1 font-semibold transition ${
                            sortMode === mode
                              ? "bg-mint-500/15 text-mint-300"
                              : "text-smoke-600 hover:text-smoke-400"
                          }`}
                        >
                          {mode === "surname" ? "A–Z" : mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto scrollbar-thin pr-1">
                    {loadingPlayers && <p className="text-center text-sm text-smoke-500">Loading squad...</p>}
                    {sortedPlayerPool.map((player) => {
                      const alreadyDrafted = draftedIds.has(player.id);
                      const eligible = effectiveSlot
                        ? canPlayPosition(player.positions, effectiveSlot.position)
                        : isUsableAnywhere(player);
                      return (
                        <PlayerPickCard
                          key={player.id}
                          player={player}
                          showRatings={config.showRatings}
                          selected={pendingPlayer?.id === player.id}
                          disabled={alreadyDrafted || !eligible}
                          tag={
                            alreadyDrafted
                              ? "already in your XI"
                              : !eligible
                                ? effectiveSlot
                                  ? `can't play ${positionLabel(effectiveSlot.position)}`
                                  : "can't be used"
                                : recommendedSlot && targetSlotIndex === null
                                  ? "recommended"
                                  : undefined
                          }
                          muted={!eligible}
                          onClick={() => handlePlayerClick(player)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <DrawReel
              target={spinTarget ?? undefined}
              spinToken={spinToken}
              spinning={spinning}
              candidates={reelCandidates}
              onSpin={() => void doSpin()}
              onSettled={handleSpinSettled}
            />
          )}
        </div>
      </div>

      {showGuestGate && (
        <GuestGateModal
          onCancel={() => setShowGuestGate(false)}
          onDone={() => {
            setShowGuestGate(false);
            void doConfirm();
          }}
        />
      )}
    </div>
  );
}
