import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { LeaderboardEntryDto, TrophyKey } from "../api/types";
import type { Difficulty, PlayerRatingsMode } from "../state/DraftContext";
import { TrophyCabinet } from "./TrophyCabinet";
import { Button } from "./ui/Button";

interface Props {
  worldId: string;
  seasonId: string;
  difficulty: Difficulty;
  ratingsMode: PlayerRatingsMode;
  defaultHandle: string;
}

/** "Add this run to the leaderboard" (38-0 §9) — a handle input + Submit block on the results
    screen. Difficulty/ratings mode ride along as self-reported Setup/Draft config (the backend has
    no other record of them); everything else the leaderboard shows (formation, standings, squad
    overall) is re-derived server-side from the world itself at submit time, not trusted from here —
    see leaderboard.service.ts's submitRun. */
export function LeaderboardSubmitBlock({ worldId, seasonId, difficulty, ratingsMode, defaultHandle }: Props) {
  const [handle, setHandle] = useState(defaultHandle);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [entry, setEntry] = useState<LeaderboardEntryDto | null>(null);
  const [newTrophies, setNewTrophies] = useState<TrophyKey[]>([]);

  async function handleSubmit() {
    const trimmed = handle.trim();
    if (trimmed.length < 2) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const result = await api.submitToLeaderboard(worldId, seasonId, { handle: trimmed, difficulty, ratingsMode });
      setEntry(result.entry);
      setNewTrophies(result.newTrophies);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done" && entry) {
    return (
      <div className="notch space-y-3 border border-mint-500/40 bg-mint-500/5 p-4 text-center">
        <p className="text-sm font-semibold text-mint-300">On the leaderboard as {entry.handle} — {entry.points} pts</p>
        {/* club-record-breaker/club-worst-ever (Phase 7) — only knowable at the moment of
            submission, unlike finalizeRun's per-run trophies, so they're not in the results
            screen's main TrophyCabinet above; surfaced here instead. */}
        {newTrophies.length > 0 && <TrophyCabinet trophies={newTrophies} />}
        <Link to="/leaderboard" className="text-xs text-mint-400 underline">
          View the leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="notch space-y-2 border border-ink-800 bg-ink-900/50 p-4 text-center">
      <p className="text-sm font-semibold text-paper">Add this run to the leaderboard</p>
      <div className="flex items-center justify-center gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          maxLength={24}
          placeholder="Your handle"
          className="notch-sm w-40 border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-paper outline-none focus:border-mint-500/60"
        />
        <Button size="sm" onClick={handleSubmit} disabled={status === "submitting"}>
          {status === "submitting" ? "Submitting…" : "Submit"}
        </Button>
      </div>
      {status === "error" && <p className="text-xs text-crimson-400">Enter a handle (2+ characters) and try again.</p>}
    </div>
  );
}
