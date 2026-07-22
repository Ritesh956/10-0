import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { LiveDraftRoomDto } from "../api/types";
import { GuestGateModal } from "../components/GuestGateModal";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth-context";

/** Join-by-invite-link landing page for a Live Draft room (Phase 9b) — mirrors LeagueJoinPage's
    preview-then-join pattern exactly, just routing into /multiplayer/live/:roomId (a live socket
    connection) instead of /setup (a solo draft config). */
export function LiveDraftJoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [room, setRoom] = useState<LiveDraftRoomDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  useEffect(() => {
    if (!code) return;
    void api.previewLiveDraftInvite(code).then(setRoom).catch((err) => setError(err instanceof Error ? err.message : "This invite link isn't valid"));
  }, [code]);

  async function doJoin() {
    if (!code || !room) return;
    setJoining(true);
    setError(null);
    try {
      const result = await api.joinLiveDraftRoom(code);
      navigate(`/multiplayer/live/${result.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join the room");
    } finally {
      setJoining(false);
    }
  }

  function handleJoinClick() {
    if (!isAuthenticated) {
      setShowGuestGate(true);
      return;
    }
    void doJoin();
  }

  if (error && !room) return <div className="mx-auto max-w-md px-6 py-24 text-center text-crimson-400">{error}</div>;
  if (!room) return <div className="mx-auto max-w-md px-6 py-24 text-center text-smoke-500">Loading invite...</div>;

  const full = room.participants.length >= room.maxSeats;
  const started = room.status !== "LOBBY";

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-plum-400">Live Draft — you're invited</p>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">{room.league.name}</h1>

      <div className="notch space-y-2 border border-ink-800 bg-ink-900/50 p-5 text-left text-sm">
        <p className="flex justify-between">
          <span className="text-smoke-500">Difficulty</span>
          <span className="font-semibold capitalize text-paper">{room.league.rules.difficulty}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-smoke-500">Formation</span>
          <span className="font-semibold text-paper">{room.league.rules.formation}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-smoke-500">Players</span>
          <span className="font-semibold text-paper">
            {room.participants.length}/{room.maxSeats}
          </span>
        </p>
      </div>

      {started ? (
        <p className="text-sm text-smoke-500">This draft has already started.</p>
      ) : full ? (
        <p className="text-sm text-smoke-500">This room is full.</p>
      ) : (
        <>
          <p className="text-sm text-smoke-500">Everyone drafts live, turn by turn, in a shared draft order — then each of you simulates your own season.</p>
          {error && <p className="text-sm text-crimson-400">{error}</p>}
          <Button size="lg" fullWidth disabled={joining} onClick={handleJoinClick}>
            {joining ? "Joining..." : "Join Room →"}
          </Button>
        </>
      )}

      {showGuestGate && (
        <GuestGateModal
          onCancel={() => setShowGuestGate(false)}
          onDone={() => {
            setShowGuestGate(false);
            void doJoin();
          }}
        />
      )}
    </div>
  );
}
