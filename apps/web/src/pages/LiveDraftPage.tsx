import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { api } from "../api/client";
import type {
  LiveDraftCompleteEvent,
  LiveDraftErrorEvent,
  LiveDraftRoomDto,
  LiveDraftSpinPlayer,
  LiveDraftSpinResultEvent,
  LiveDraftStateEvent,
  PlayerSeasonDto,
} from "../api/types";
import { PlayerPickCard } from "../components/PlayerPickCard";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth-context";
import { createLiveDraftSocket } from "../lib/liveDraftSocket";
import { useDraft } from "../state/DraftContext";

function toPlayerSeasonDto(p: LiveDraftSpinPlayer): PlayerSeasonDto {
  return {
    id: p.id,
    playerId: p.playerId,
    clubSeasonId: "",
    seasonYear: 0,
    positions: p.positions,
    overall: p.overall,
    potential: p.overall,
    player: { name: p.name, nationality: p.nationality, photoUrl: p.photoUrl },
    clubSeason: { club: { id: "", name: "" } },
  };
}

const PLACEHOLDER_PICK: LiveDraftSpinPlayer = {
  id: "",
  playerId: "",
  name: "Drafted player",
  nationality: "",
  photoUrl: null,
  positions: [],
  overall: 0,
};

/** Real-time turn-based Live Draft (Phase 9b). One socket for the whole lobby→drafting→complete
    lifecycle — the server is fully authoritative (whose turn it is, what's been drafted, when the
    room finishes), this page just renders whatever "room:state"/"draft:spinResult"/"room:complete"
    it's told. Deliberately doesn't reuse DrawReel/SlotReel's slot-machine animation — those assume
    the client already knows the winner and animates toward it locally, which doesn't fit a
    server-decided, live-broadcast spin; a plain reveal keeps the server/client contract simple. */
export function LiveDraftPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setWorldId } = useDraft();

  const [initialRoom, setInitialRoom] = useState<LiveDraftRoomDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<LiveDraftStateEvent | null>(null);
  const [spinResult, setSpinResult] = useState<LiveDraftSpinResultEvent | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [complete, setComplete] = useState<LiveDraftCompleteEvent | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<Socket | null>(null);
  // Player display info is only ever broadcast via a spin — a pick made before this client was
  // watching (auto-picked on timeout, or joined mid-draft) falls back to PLACEHOLDER_PICK. See the
  // component doc comment; a known, documented v1 limitation, not a data-correctness issue.
  const cacheRef = useRef<Map<string, LiveDraftSpinPlayer>>(new Map());

  useEffect(() => {
    if (!roomId) return;
    void api
      .getLiveDraftRoom(roomId)
      .then(setInitialRoom)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load this room"));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const socket = createLiveDraftSocket();
    socketRef.current = socket;

    function enter() {
      socket.emit("room:enter", { roomId });
    }
    socket.on("connect", enter);
    socket.on("room:state", (s: LiveDraftStateEvent) => {
      setState(s);
      setSpinResult(null);
      setSpinning(false);
    });
    socket.on("draft:spinResult", (r: LiveDraftSpinResultEvent) => {
      for (const p of r.players) cacheRef.current.set(p.id, p);
      setSpinResult(r);
      setSpinning(false);
    });
    socket.on("room:complete", (c: LiveDraftCompleteEvent) => setComplete(c));
    socket.on("error", (e: LiveDraftErrorEvent) => {
      setWsError(e.message);
      setSpinning(false);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!complete || !user) return;
    const mine = complete.results.find((r) => r.userId === user.id);
    if (mine?.worldId) setWorldId(mine.worldId);
  }, [complete, user, setWorldId]);

  function startRoom() {
    setWsError(null);
    socketRef.current?.emit("room:start", { roomId });
  }

  function doSpin() {
    setWsError(null);
    setSpinning(true);
    socketRef.current?.emit("draft:spin", { roomId });
  }

  function pickPlayer(refPlayerSeasonId: string) {
    setWsError(null);
    socketRef.current?.emit("draft:pick", { roomId, refPlayerSeasonId });
  }

  const participants = state?.participants ?? initialRoom?.participants.map((p) => ({
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    seatIndex: p.seatIndex,
    isActive: false,
    pickCount: 0,
  })) ?? [];
  const myParticipant = participants.find((p) => p.userId === user?.id);
  const isHost = initialRoom?.hostUserId === user?.id;
  const activeParticipant = participants.find((p) => p.isActive);
  const isMyTurn = Boolean(state?.status === "IN_PROGRESS" && activeParticipant && activeParticipant.userId === user?.id);
  const status = state?.status ?? initialRoom?.status ?? "LOBBY";

  const myPicks = useMemo(() => {
    if (!state || !myParticipant) return [];
    return state.picks
      .filter((p) => p.participantId === myParticipant.id)
      .map((p) => cacheRef.current.get(p.refPlayerSeasonId) ?? { ...PLACEHOLDER_PICK, id: p.refPlayerSeasonId });
  }, [state, myParticipant]);

  const recentPicks = useMemo(() => {
    if (!state) return [];
    return [...state.picks]
      .reverse()
      .slice(0, 8)
      .map((p) => ({
        pick: p,
        participant: participants.find((pt) => pt.id === p.participantId),
        player: cacheRef.current.get(p.refPlayerSeasonId) ?? PLACEHOLDER_PICK,
      }));
  }, [state, participants]);

  const turnDeadlineMs = state?.turnStartedAt ? new Date(state.turnStartedAt).getTime() + state.turnTimeoutMs : null;
  const secondsLeft = turnDeadlineMs !== null ? Math.max(0, Math.round((turnDeadlineMs - now) / 1000)) : null;

  if (loadError) return <div className="mx-auto max-w-md px-6 py-24 text-center text-crimson-400">{loadError}</div>;
  if (!initialRoom) return <div className="mx-auto max-w-md px-6 py-24 text-center text-smoke-500">Loading room...</div>;

  const inviteUrl = `${window.location.origin}/multiplayer/live/join/${initialRoom.inviteCode}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-plum-400">Live Draft</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">{initialRoom.league.name}</h1>
        <p className="mt-1 text-xs text-smoke-500 capitalize">
          {initialRoom.league.rules.difficulty} &middot; {initialRoom.league.rules.formation}
        </p>
      </div>

      {wsError && <p className="text-center text-sm text-crimson-400">{wsError}</p>}

      {status === "LOBBY" && (
        <div className="space-y-5">
          <div className="notch flex flex-wrap items-center justify-between gap-3 border border-ink-800 bg-ink-900/50 p-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-smoke-600">Invite link</p>
              <p className="truncate text-sm text-paper">{inviteUrl}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>
              Copy
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">
              Players ({participants.length}/{initialRoom.maxSeats})
            </p>
            {participants.map((p) => (
              <div key={p.id} className="notch-sm flex items-center justify-between border border-ink-800 bg-ink-900/40 px-4 py-2.5">
                <span className="text-paper">
                  {p.displayName} {p.userId === initialRoom.hostUserId && <span className="text-xs text-mint-400">(Host)</span>}
                  {p.userId === user?.id && <span className="text-xs text-smoke-500"> (You)</span>}
                </span>
                <span className="text-xs text-smoke-500">Seat {p.seatIndex + 1}</span>
              </div>
            ))}
          </div>

          {isHost ? (
            <Button fullWidth size="lg" disabled={participants.length < 2} onClick={startRoom}>
              {participants.length < 2 ? "Waiting for at least 2 players..." : "Start Draft →"}
            </Button>
          ) : (
            <p className="text-center text-sm text-smoke-500">Waiting for the host to start the draft...</p>
          )}
        </div>
      )}

      {status === "IN_PROGRESS" && state && (
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <div className="notch space-y-1 border border-ink-800 bg-ink-900/50 p-4 text-center">
              <p className="font-display text-lg font-bold text-paper">
                {isMyTurn ? "Your turn!" : `Waiting for ${activeParticipant?.displayName ?? "..."}`}
              </p>
              <p className="text-xs text-smoke-500">
                Pick {state.currentPickNumber + 1} of {participants.length * 11}
                {secondsLeft !== null && <span> &middot; {secondsLeft}s left</span>}
              </p>
            </div>

            {isMyTurn && !spinResult && (
              <Button fullWidth size="lg" disabled={spinning} onClick={doSpin}>
                {spinning ? "Spinning..." : "Spin for a Club →"}
              </Button>
            )}

            {spinResult && (
              <div className="space-y-2">
                <p className="text-center text-sm font-semibold text-paper">
                  {spinResult.club.name} {spinResult.club.seasonYear}
                </p>
                {isMyTurn ? (
                  <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                    {spinResult.players.map((p) => (
                      <PlayerPickCard key={p.id} player={toPlayerSeasonDto(p)} showRatings onClick={() => pickPlayer(p.id)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-smoke-500">Watching {activeParticipant?.displayName} pick...</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">
                Your Squad ({myParticipant?.pickCount ?? 0}/11)
              </p>
              {myPicks.map((p, i) => (
                <div key={`${p.id}-${i}`} className="notch-sm flex items-center justify-between border border-ink-800 bg-ink-900/40 px-3 py-2 text-sm">
                  <span className="text-paper">{p.name}</span>
                  {p.overall > 0 && <span className="font-display text-xs font-bold text-mint-400">{p.overall}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">Draft Order</p>
              {participants.map((p) => (
                <div
                  key={p.id}
                  className={`notch-sm flex items-center justify-between border px-3 py-2 text-sm ${
                    p.isActive ? "border-mint-500/60 bg-mint-500/10" : "border-ink-800 bg-ink-900/40"
                  }`}
                >
                  <span className="truncate text-paper">
                    {p.displayName} {p.userId === user?.id && <span className="text-xs text-smoke-500">(You)</span>}
                  </span>
                  <span className="shrink-0 text-xs text-smoke-500">{p.pickCount}/11</span>
                </div>
              ))}
            </div>

            {recentPicks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">Recent Picks</p>
                {recentPicks.map(({ pick, participant, player }) => (
                  <p key={pick.pickNumber} className="text-xs text-smoke-500">
                    <span className="text-paper">{participant?.displayName ?? "?"}</span> drafted{" "}
                    <span className="text-paper">{player.name}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(status === "COMPLETED" || complete) && (
        <div className="notch space-y-4 border border-mint-500/30 bg-mint-500/5 p-6 text-center">
          <p className="font-display text-lg font-bold text-paper">Draft complete!</p>
          {complete ? (
            <div className="space-y-2">
              {complete.results.map((r) => {
                const p = participants.find((pt) => pt.userId === r.userId);
                return (
                  <p key={r.userId} className="text-sm">
                    <span className="text-paper">{p?.displayName ?? r.userId}</span>{" "}
                    {r.worldId ? (
                      <span className="text-mint-400">ready</span>
                    ) : (
                      <span className="text-crimson-400">couldn&apos;t build a full squad — {r.error}</span>
                    )}
                  </p>
                );
              })}
              {complete.results.find((r) => r.userId === user?.id)?.worldId && (
                <Button size="lg" onClick={() => navigate("/season")}>
                  Simulate My Season →
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-smoke-500">Finishing up everyone's squads...</p>
          )}
        </div>
      )}
    </div>
  );
}
