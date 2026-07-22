import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { ClubSeasonDto, DailyChallengeDto, DailyChallengeEntryDto, PlayerSeasonDto, SubmitDailyResultDto } from "../api/types";
import { DrawReel, type ReelCandidate } from "../components/DrawReel";
import { PitchView, type PitchSlotState } from "../components/PitchView";
import { PlayerPickCard } from "../components/PlayerPickCard";
import { RequirementsTracker } from "../components/RequirementsTracker";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth-context";
import { buildOddsInput, computeCompletionOdds, countMatches } from "../lib/dailyOdds";
import { canPlayPosition, isFormation, positionLabel, slotsForFormation, type Formation } from "../lib/formations";
import { isRealCountry } from "../lib/leagues";
import { surname } from "../lib/positionColors";

const DAILY_REROLLS = 3;
const MAX_ATTEMPTS = 5;
const MAX_AUTO_REROLL_ATTEMPTS = 8;

type SortMode = "rating" | "surname";

function sampleReelCandidates(pool: ClubSeasonDto[], count = 14): ReelCandidate[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((cs) => ({ club: cs.club.name, year: cs.seasonYear }));
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

/** The pre-seeded anchor's own display shape, reshaped to a PlayerSeasonDto so it can live in the
    same `picks` record as drafted players and feed the same PitchView/scoring helpers. */
function anchorAsPick(challenge: DailyChallengeDto): PlayerSeasonDto {
  const a = challenge.anchor;
  return {
    id: a.id,
    playerId: a.playerId,
    clubSeasonId: "",
    seasonYear: 0,
    positions: a.positions,
    overall: a.overall,
    potential: a.overall,
    player: { name: a.name, nationality: a.nationality, photoUrl: a.photoUrl },
    clubSeason: { club: { id: a.clubId, name: a.clubName } },
  };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "refreshing…";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function DailyChallengePage() {
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<DailyChallengeDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [pool, setPool] = useState<ClubSeasonDto[] | null>(null);
  const [anchorSlotIndex, setAnchorSlotIndex] = useState<number | null>(null);
  const [picks, setPicks] = useState<Record<number, PlayerSeasonDto>>({});
  const [rerollsUsed, setRerollsUsed] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("rating");

  const [currentClub, setCurrentClub] = useState<ClubSeasonDto | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinTarget, setSpinTarget] = useState<ReelCandidate | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const spinSettleResolveRef = useRef<(() => void) | null>(null);
  const [reelCandidates, setReelCandidates] = useState<ReelCandidate[]>([]);
  const [playerPool, setPlayerPool] = useState<PlayerSeasonDto[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<PlayerSeasonDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [handle, setHandle] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [submitResult, setSubmitResult] = useState<SubmitDailyResultDto | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<DailyChallengeEntryDto[] | null>(null);

  useEffect(() => {
    if (!handle && user?.displayName) setHandle(user.displayName);
  }, [user, handle]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await api.getDailyChallenge();
        if (!cancelled) setChallenge(c);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load today's challenge");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once the challenge is known: pre-seed the anchor into a compatible pitch slot, and load the
  // real top-5 club pool the reel spins through (same pool the puzzle was generated from).
  useEffect(() => {
    if (!challenge) return;
    let cancelled = false;
    (async () => {
      try {
        const formation = isFormation(challenge.fixedFormation) ? challenge.fixedFormation : "4-3-3";
        const formationSlots = slotsForFormation(formation);
        const idx = formationSlots.findIndex((slot) => canPlayPosition(challenge.anchor.positions, slot.position));
        const anchorIndex = idx >= 0 ? idx : 0;
        if (!cancelled) {
          setAnchorSlotIndex(anchorIndex);
          setPicks({ [anchorIndex]: anchorAsPick(challenge) });
        }

        const leagues = await api.listLeagues();
        const leagueIds = leagues.filter((l) => isRealCountry(l.country)).map((l) => l.id);
        const clubSeasons = await api.listClubSeasons({ leagueIds });
        if (!cancelled) setPool(clubSeasons.filter((cs) => isRealCountry(cs.club.country)));

        const board = await api.getDailyLeaderboard(challenge.id);
        if (!cancelled) setLeaderboard(board);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load the draft pool");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge]);

  const formation: Formation = challenge && isFormation(challenge.fixedFormation) ? challenge.fixedFormation : "4-3-3";
  const slots = slotsForFormation(formation);
  const filledCount = Object.keys(picks).length;
  const allFilled = Boolean(challenge) && filledCount >= slots.length;
  const emptySlotIndices = slots.map((_, i) => i).filter((i) => !(i in picks));
  const recommendedSlotIndex = emptySlotIndices.length === 1 ? emptySlotIndices[0]! : null;
  const remainingPositions = [...new Set(emptySlotIndices.map((i) => slots[i]!.position))];

  function isUsableAnywhere(player: PlayerSeasonDto): boolean {
    return remainingPositions.some((pos) => canPlayPosition(player.positions, pos));
  }

  async function loadPlayersFor(club: ClubSeasonDto): Promise<PlayerSeasonDto[] | null> {
    setLoadingPlayers(true);
    try {
      const players = await api.listPlayerSeasons({ clubSeasonId: club.id, ratingsMode: "season" });
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

  async function doSpin(excludeIds?: Set<string>, autoRerollAttempt = 0) {
    if (!pool || pool.length === 0) {
      setError("The real club pool failed to load — try refreshing the page.");
      return;
    }
    setError(null);
    setPendingPlayer(null);
    setPlayerPool([]);
    const candidates = excludeIds && excludeIds.size > 0 ? pool.filter((cs) => !excludeIds.has(cs.id)) : pool;
    const source = candidates.length > 0 ? candidates : pool;
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
    if (players === null) return;

    if (!players.some((p) => isUsableAnywhere(p))) {
      if (autoRerollAttempt >= MAX_AUTO_REROLL_ATTEMPTS) {
        setError("None of the last several draws had anyone who could fill an open slot — try again.");
        return;
      }
      const nextExcluded = new Set(excludeIds);
      nextExcluded.add(club.id);
      await doSpin(nextExcluded, autoRerollAttempt + 1);
    }
  }

  const rerollsRemaining = Math.max(DAILY_REROLLS - rerollsUsed, 0);
  function handleReroll() {
    if (rerollsRemaining <= 0 || !currentClub) return;
    setRerollsUsed((n) => n + 1);
    void doSpin(new Set([currentClub.id]));
  }

  function resetSpinState() {
    setCurrentClub(null);
    setPlayerPool([]);
    setPendingPlayer(null);
  }

  function assignPlayer(slotIndex: number, player: PlayerSeasonDto) {
    setPicks((prev) => ({ ...prev, [slotIndex]: player }));
    resetSpinState();
  }

  function tryAssignPlayer(slotIndex: number, player: PlayerSeasonDto): boolean {
    const slot = slots[slotIndex];
    if (!slot || !canPlayPosition(player.positions, slot.position)) {
      setError(`${player.player.name} can't play ${slot ? positionLabel(slot.position) : ""} (${slot?.position ?? ""}).`);
      return false;
    }
    setError(null);
    assignPlayer(slotIndex, player);
    return true;
  }

  function handlePlayerClick(player: PlayerSeasonDto) {
    if (Object.values(picks).some((p) => p.id === player.id)) return;
    if (recommendedSlotIndex !== null) {
      if (!tryAssignPlayer(recommendedSlotIndex, player)) setPendingPlayer(player);
    } else {
      setPendingPlayer(player);
    }
  }

  function handlePitchSlotClick(index: number) {
    if (index === anchorSlotIndex) return; // the anchor is pre-seeded, never drafted, never moved
    if (picks[index]) {
      setPicks((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }
    if (pendingPlayer) tryAssignPlayer(index, pendingPlayer);
  }

  function startNewAttempt() {
    if (!challenge) return;
    setPicks({ [anchorSlotIndex ?? 0]: anchorAsPick(challenge) });
    setRerollsUsed(0);
    resetSpinState();
    setError(null);
    setSubmitStatus("idle");
    setSubmitResult(null);
    setSubmitErrorMsg(null);
  }

  async function handleSubmit() {
    if (!challenge) return;
    const trimmed = handle.trim();
    if (trimmed.length < 2) {
      setSubmitErrorMsg("Enter a handle (2+ characters) first.");
      return;
    }
    setSubmitStatus("submitting");
    setSubmitErrorMsg(null);
    try {
      const pickIds = slots.map((_, i) => picks[i]?.id).filter((id): id is string => Boolean(id));
      const result = await api.submitDailyAttempt(challenge.id, trimmed, pickIds);
      setSubmitResult(result);
      setSubmitStatus("done");
      const board = await api.getDailyLeaderboard(challenge.id);
      setLeaderboard(board);
    } catch (err) {
      setSubmitErrorMsg(err instanceof Error ? err.message : "Failed to submit your attempt");
      setSubmitStatus("error");
    }
  }

  const nonAnchorPicks = useMemo(
    () =>
      Object.entries(picks)
        .filter(([idx]) => Number(idx) !== anchorSlotIndex)
        .map(([, p]) => p),
    [picks, anchorSlotIndex],
  );
  const matchedByConstraint = challenge ? challenge.constraints.map((c) => countMatches(nonAnchorPicks, c)) : [];
  const completionOdds = challenge
    ? computeCompletionOdds(buildOddsInput(slots.length - filledCount, nonAnchorPicks, challenge.constraints, challenge.poolStats))
    : 0;

  const attemptsUsedSoFar = submitResult?.attemptsUsed ?? 0;
  const attemptsRemaining = submitResult ? submitResult.attemptsRemaining : MAX_ATTEMPTS;

  const slotState: Record<number, PitchSlotState> = {};
  slots.forEach((slot, i) => {
    const player = picks[i];
    slotState[i] = player
      ? { filled: { name: player.player.name, overall: player.overall, photoUrl: player.player.photoUrl } }
      : { ineligible: pendingPlayer ? !canPlayPosition(pendingPlayer.positions, slot.position) : false };
  });

  const sortedPlayerPool = useMemo(() => {
    const copy = [...playerPool];
    if (sortMode === "rating") copy.sort((a, b) => b.overall - a.overall);
    else copy.sort((a, b) => surname(a.player.name).localeCompare(surname(b.player.name)));
    const usable = copy.filter((p) => isUsableAnywhere(p));
    const unusable = copy.filter((p) => !isUsableAnywhere(p));
    return [...usable, ...unusable];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPool, sortMode, remainingPositions.join(",")]);

  if (loadError) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-crimson-400">{loadError}</div>;
  }
  if (!challenge) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-smoke-500">Loading today's challenge…</div>;
  }

  const countdownMs = new Date(challenge.refreshesAt).getTime() - now;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="notch space-y-1 border border-ink-800 bg-ink-900/60 p-5 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-smoke-500">Daily Challenge · {challenge.date}</p>
        <h1 className="font-display text-2xl font-bold text-paper">{challenge.themeLabel}</h1>
        <p className="text-sm text-smoke-500">
          Fixed formation <span className="font-semibold text-paper">{challenge.fixedFormation}</span> · Refreshes in{" "}
          <span className="font-semibold text-paper">{formatCountdown(countdownMs)}</span>
        </p>
        <p className="text-xs text-smoke-500">
          Anchor: <span className="font-semibold text-mint-400">{challenge.anchor.name}</span> ({challenge.anchor.nationality},{" "}
          {challenge.anchor.clubName}) is pre-seeded into your XI — build the rest of the squad around them.
        </p>
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <PitchView formation={formation} slotState={slotState} onSlotClick={handlePitchSlotClick} />

          {!allFilled ? (
            <div className="space-y-4">
              <DrawReel
                target={spinTarget ?? undefined}
                leagueName={currentClub?.league.name}
                candidates={reelCandidates}
                spinToken={spinToken}
                spinning={spinning}
                disabled={loadingPlayers || !pool}
                onSpin={() => void doSpin()}
                onSettled={handleSpinSettled}
              />
              <div className="flex items-center justify-center gap-3 text-xs text-smoke-500">
                <span>
                  Rerolls: {rerollsRemaining}/{DAILY_REROLLS}
                </span>
                <Button size="sm" variant="outline" disabled={rerollsRemaining <= 0 || !currentClub} onClick={handleReroll}>
                  Reroll this club
                </Button>
              </div>

              {currentClub && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-paper">
                      {currentClub.club.name} {currentClub.seasonYear}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant={sortMode === "rating" ? "primary" : "ghost"} onClick={() => setSortMode("rating")}>
                        Rating
                      </Button>
                      <Button size="sm" variant={sortMode === "surname" ? "primary" : "ghost"} onClick={() => setSortMode("surname")}>
                        A-Z
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                    {sortedPlayerPool.map((player) => (
                      <PlayerPickCard
                        key={player.id}
                        player={player}
                        showRatings
                        selected={pendingPlayer?.id === player.id}
                        muted={!isUsableAnywhere(player)}
                        onClick={() => handlePlayerClick(player)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="notch space-y-3 border border-mint-500/30 bg-mint-500/5 p-5 text-center">
              <p className="text-sm font-semibold text-paper">Squad complete — average overall {average(Object.values(picks).map((p) => p.overall))}</p>
              {submitStatus === "done" && submitResult ? (
                <div className="space-y-1">
                  <p className="font-display text-lg font-bold text-mint-400">
                    Score: {submitResult.score} / {submitResult.maxScore}
                  </p>
                  <p className="text-xs text-smoke-500">
                    {submitResult.isNewBest ? "New best for today! " : ""}
                    Attempt {submitResult.attemptsUsed}/{MAX_ATTEMPTS} used ({submitResult.attemptsRemaining} remaining)
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    maxLength={24}
                    placeholder="Your handle"
                    className="notch-sm w-40 border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-paper outline-none focus:border-mint-500/60"
                  />
                  <Button size="sm" onClick={() => void handleSubmit()} disabled={submitStatus === "submitting"}>
                    {submitStatus === "submitting" ? "Submitting…" : "Submit Squad"}
                  </Button>
                </div>
              )}
              {submitErrorMsg && <p className="text-xs text-crimson-400">{submitErrorMsg}</p>}
              <Button size="sm" variant="outline" onClick={startNewAttempt} disabled={attemptsRemaining <= 0 && attemptsUsedSoFar > 0}>
                Start a new attempt
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <RequirementsTracker constraints={challenge.constraints} matchedByConstraint={matchedByConstraint} completionOdds={completionOdds} />

          {leaderboard && leaderboard.length > 0 && (
            <div className="notch space-y-2 border border-ink-800 bg-ink-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-smoke-500">Today's Top Scores</p>
              <ol className="space-y-1.5 text-sm">
                {leaderboard.slice(0, 8).map((entry, i) => (
                  <li key={entry.id} className="flex items-center justify-between text-smoke-400">
                    <span className="truncate">
                      {i + 1}. {entry.handle}
                    </span>
                    <span className="font-display font-bold text-paper">{entry.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
