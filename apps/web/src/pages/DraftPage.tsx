import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ClubSeasonDto, ManagerDto, PlayerSeasonDto } from "../api/types";
import { DraftedPlayerRow } from "../components/DraftedPlayerRow";
import { DrawReel } from "../components/DrawReel";
import { GuestGateModal } from "../components/GuestGateModal";
import { PitchView, type PitchSlotState } from "../components/PitchView";
import { PlayerPickCard } from "../components/PlayerPickCard";
import { Button } from "../components/ui/Button";
import { RatingBar } from "../components/ui/RatingBar";
import { POSITION_GROUP, positionLabel, slotsForFormation, type Position, type PositionGroup } from "../lib/formations";
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

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
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
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DraftPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
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

  const slots = slotsForFormation(config.formation);
  const filledCount = Object.keys(picks).length;
  const allFilled = filledCount >= slots.length;

  const [pool, setPool] = useState<ClubSeasonDto[] | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);

  const [currentClub, setCurrentClub] = useState<ClubSeasonDto | null>(null);
  const [spinning, setSpinning] = useState(false);
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
            cs.seasonYear >= (config.eraYearMin ?? 0) && cs.seasonYear <= (config.eraYearMax ?? 9999),
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

  async function loadPlayersFor(club: ClubSeasonDto) {
    setLoadingPlayers(true);
    try {
      const players = await api.listPlayerSeasons({ clubSeasonId: club.id, ratingsMode: config.playerRatings });
      setPlayerPool(players);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoadingPlayers(false);
    }
  }

  async function doSpin(excludeId?: string) {
    if (!pool || pool.length === 0) {
      setError("No club seasons match your league and era filters — go back and widen them.");
      return;
    }
    setError(null);
    setSpinning(true);
    setPendingPlayer(null);
    setPlayerPool([]);
    const candidates = excludeId ? pool.filter((cs) => cs.id !== excludeId) : pool;
    const source = candidates.length > 0 ? candidates : pool;
    await new Promise((resolve) => setTimeout(resolve, 900));
    const club = source[Math.floor(Math.random() * source.length)]!;
    setCurrentClub(club);
    setSpinning(false);
    await loadPlayersFor(club);
  }

  function handleReroll() {
    if (rerollsRemaining <= 0 || !currentClub) return;
    useReroll();
    void doSpin(currentClub.id);
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

  function handlePlayerClick(player: PlayerSeasonDto) {
    if (Object.values(picks).some((p) => p.id === player.id)) return; // already in the XI
    if (config.draftMode === "position-first" && targetSlotIndex !== null) {
      assignPlayer(targetSlotIndex, player);
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
        if (movingPlayer) {
          removePick(moveSourceIndex);
          addPick(index, movingPlayer);
        }
        setMoveSourceIndex(null);
        setMoveMode(false);
      }
      return;
    }
    if (picks[index]) return; // slot already filled
    if (config.draftMode === "squad-first" && pendingPlayer) {
      assignPlayer(index, pendingPlayer);
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
      await api.draftFantasy(world.id, squadName, config.formation, refPlayerSeasonIds, managerPick?.id);
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
            ? !pendingPlayer.positions.includes(slot.position)
            : movingPlayer
              ? !movingPlayer.positions.includes(slot.position)
              : false,
        };
  });

  const targetSlot = targetSlotIndex !== null ? slots[targetSlotIndex] : null;

  const sortedPlayerPool = useMemo(() => sortPlayers(playerPool, sortMode), [playerPool, sortMode]);

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

  const odds = useMemo(() => {
    const strength = Math.max(0, Math.min(1, (overallRating - 55) / 35));
    const seasonSize = 8;
    const matches = (seasonSize - 1) * 2;
    const maxPoints = matches * 3;
    return {
      seasonSize,
      expectedPoints: Math.round(strength * maxPoints * 0.65 + 8),
      winPct: Math.max(1, Math.min(95, Math.round(strength ** 2 * 90))),
      top4Pct: Math.max(3, Math.min(99, Math.round(20 + strength * 78))),
      relegationPct: Math.max(0, Math.min(70, Math.round((1 - strength) ** 2 * 70))),
      projectedFinish: Math.max(1, Math.min(seasonSize, Math.round(seasonSize - strength * (seasonSize - 1)))),
    };
  }, [overallRating]);

  const pitchClickable = moveMode
    ? handlePitchSlotClick
    : allFilled
      ? undefined
      : config.draftMode === "squad-first"
        ? (pendingPlayer ? handlePitchSlotClick : undefined)
        : (!currentClub && !spinning ? handlePitchSlotClick : undefined);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">Draft Room</h1>
          <p className="text-sm text-smoke-500">
            {config.formation} &middot; {filledCount}/{slots.length} filled &middot; {rerollsRemaining} redraws left
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetDraft();
            resetSpinState();
            setMoveMode(false);
            setMoveSourceIndex(null);
            setPostDraftStep("review");
            setManagerPick(null);
          }}
        >
          &#8635; Restart run
        </Button>
      </div>

      {(error || poolError) && <p className="mb-4 text-sm text-crimson-400">{error ?? poolError}</p>}

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <PitchView
            formation={config.formation}
            slotState={slotState}
            activeSlotIndex={(moveMode ? moveSourceIndex : targetSlotIndex) ?? undefined}
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

          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-smoke-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-plum-400" /> Keeper
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gold-400" /> Defence
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
            <div className="notch mt-4 space-y-3 border-2 border-ink-700 bg-ink-900/50 p-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-smoke-600">Overall</p>
                <p className="font-display text-3xl font-bold text-paper">{overallRating}</p>
              </div>
              <RatingBar label="Attack" value={squadRatings.attack} colorClass="bg-crimson-400" />
              <RatingBar label="Midfield" value={squadRatings.midfield} colorClass="bg-teal-400" />
              <RatingBar label="Defence" value={squadRatings.defence} colorClass="bg-gold-400" />
              <RatingBar label="Goalkeeping" value={squadRatings.gk} colorClass="bg-plum-400" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
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
                  <h2 className="font-display text-xl font-bold uppercase tracking-wide text-paper">Your XI</h2>
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
              <div className="notch space-y-4 border-2 border-ink-700 bg-ink-900/50 p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">Optional</p>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-paper">Add a manager?</h2>
                <p className="text-sm text-smoke-500">
                  A real manager's tactical identity changes how your team actually plays &mdash; and its odds.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    fullWidth
                    disabled={spinningManager}
                    onClick={() => {
                      setSpinningManager(true);
                      setError(null);
                      void api
                        .rollManager()
                        .then((manager) => {
                          setManagerPick(manager);
                          setPostDraftStep("preseason");
                        })
                        .catch((err) => setError(err instanceof Error ? err.message : "Failed to draw a gaffer"))
                        .finally(() => setSpinningManager(false));
                    }}
                  >
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
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold-400">Squad Complete</p>
                  <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-paper">
                    {managerPick ? `Under ${managerPick.name}` : "Ready for kickoff"}
                  </h2>
                  <p className="mt-2 text-sm text-smoke-500">
                    Here&apos;s what the numbers say. Simulate the season to see if you beat it.
                  </p>
                </div>

                {managerPick && (
                  <div className="notch space-y-3 border-2 border-ink-700 bg-ink-900/60 p-5 text-left">
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

                <div className="notch space-y-4 border-2 border-ink-700 bg-ink-900/60 p-5 text-left">
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
                      <p className="font-display text-2xl font-bold text-gold-400">{odds.expectedPoints}</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-ink-800 pt-3">
                    <OddsBar label="Win the league" pct={odds.winPct} colorClass="bg-gold-400" />
                    <OddsBar label="Top 4 (Europe)" pct={odds.top4Pct} colorClass="bg-teal-400" />
                    <OddsBar label="Relegation" pct={odds.relegationPct} colorClass="bg-crimson-400" />
                  </div>
                  <p className="text-xs text-ink-600">
                    What an Overall {overallRating} squad should produce. Simulate to see if you beat it.
                  </p>
                </div>

                <input
                  value={squadName}
                  onChange={(e) => setSquadName(e.target.value)}
                  className="notch-sm w-full border-2 border-ink-700 bg-ink-950 px-3 py-2 text-center text-sm text-paper outline-none focus:border-gold-500"
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
                <DrawReel spinning={spinning} onSpin={() => void doSpin()} />
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
                  clubName={currentClub?.club.name}
                  seasonYear={currentClub?.seasonYear}
                  leagueName={currentClub?.league.name}
                  spinning={spinning}
                  disabled
                  onSpin={() => void doSpin()}
                />
              ) : (
                <div className="notch border-2 border-ink-700 bg-ink-900/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="notch-sm border border-gold-500/40 bg-gold-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-400">
                        Squad Drawn
                      </span>
                      <span className="notch-sm border border-ink-700 bg-ink-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-smoke-400">
                        {config.playerRatings === "prime" ? "Prime" : "Season"}
                      </span>
                      <span className="text-xs text-smoke-500">{slots.length - filledCount} slots left</span>
                    </div>
                    <Button variant="outline" size="sm" disabled={rerollsRemaining <= 0} onClick={handleReroll}>
                      Redraw ({rerollsRemaining} left)
                    </Button>
                  </div>
                  <p className="mt-2 font-display text-lg font-bold uppercase tracking-wide text-paper">
                    {currentClub.club.name} <span className="text-gold-400">{currentClub.seasonYear}</span>
                  </p>
                  <p className="text-xs text-smoke-500">{currentClub.league.name}</p>
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
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                      <span className="text-ink-600">Sort:</span>
                      {(["rating", "position", "surname"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSortMode(mode)}
                          className={
                            sortMode === mode
                              ? "font-semibold text-gold-400"
                              : "text-smoke-600 hover:text-smoke-400"
                          }
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
                      return (
                        <PlayerPickCard
                          key={player.id}
                          player={player}
                          showRatings={config.showRatings}
                          selected={pendingPlayer?.id === player.id}
                          disabled={alreadyDrafted}
                          tag={
                            alreadyDrafted
                              ? "already in your XI"
                              : targetSlot && !player.positions.includes(targetSlot.position)
                                ? "off-position"
                                : undefined
                          }
                          muted={targetSlot ? !player.positions.includes(targetSlot.position) : false}
                          onClick={() => handlePlayerClick(player)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <DrawReel spinning={spinning} onSpin={() => void doSpin()} />
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
