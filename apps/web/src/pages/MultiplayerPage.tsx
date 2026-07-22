import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { EraDto, LeagueDto, LiveDraftRoomDto, MultiplayerLeagueDto } from "../api/types";
import { FormationPicker } from "../components/FormationPicker";
import { GuestGateModal } from "../components/GuestGateModal";
import { LeaguePicker } from "../components/LeaguePicker";
import { Button } from "../components/ui/Button";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Toggle } from "../components/ui/Toggle";
import { useAuth } from "../lib/auth-context";
import { isFormation, type Formation } from "../lib/formations";
import { isRealCountry } from "../lib/leagues";
import type { Difficulty } from "../state/DraftContext";

/** Phase 9a: async multiplayer Leagues — replaces the old pass-and-play "Head to Head" mode (one
    shared World, two WorldClubs, a single simulated fixture) with 38-0's own model: a creator locks
    shared rules once, everyone who joins independently drafts + simulates their OWN solo World/
    Season under those rules, ranked by points. See plans/futbol-38-0-revamp-plan.md §14. */
export function MultiplayerPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [myLeagues, setMyLeagues] = useState<MultiplayerLeagueDto[] | null>(null);
  const [myLiveRooms, setMyLiveRooms] = useState<LiveDraftRoomDto[] | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);

  const [roomKind, setRoomKind] = useState<"async" | "live">("async");
  const [eras, setEras] = useState<EraDto[]>([]);
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [name, setName] = useState("");
  const [eraId, setEraId] = useState("");
  const [leagueIds, setLeagueIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [formationFreedom, setFormationFreedom] = useState(true);
  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [maxSeats, setMaxSeats] = useState(4);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);

  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    void api.listEras().then((list) => {
      setEras(list);
      if (list[0]) setEraId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!eraId) return;
    void api
      .listLeagues(eraId)
      .then((list) => setLeagues(list.filter((l) => isRealCountry(l.country))))
      .catch(() => setLeagues([]));
  }, [eraId]);

  function refreshMine() {
    setLoadingMine(true);
    Promise.all([
      api.getMyLeagues().catch(() => []),
      api.getMyLiveDraftRooms().catch(() => []),
    ])
      .then(([leaguesRes, roomsRes]) => {
        setMyLeagues(leaguesRes);
        setMyLiveRooms(roomsRes);
      })
      .finally(() => setLoadingMine(false));
  }

  useEffect(() => {
    if (isAuthenticated) refreshMine();
  }, [isAuthenticated]);

  async function doCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      if (roomKind === "live") {
        const room = await api.createLiveDraftRoom({
          name: name.trim() || "My Live Draft",
          eraId,
          leagueIds,
          difficulty,
          formation,
          maxSeats,
        });
        navigate(`/multiplayer/live/${room.id}`);
      } else {
        const league = await api.createLeague({
          name: name.trim() || "My League",
          eraId,
          leagueIds,
          difficulty,
          formationFreedom,
          ...(formationFreedom ? {} : { formation }),
        });
        navigate(`/multiplayer/league/${league.id}`);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create the room");
    } finally {
      setCreating(false);
    }
  }

  function handleCreateClick() {
    if (!eraId || leagueIds.length === 0) {
      setCreateError("Pick a league before creating.");
      return;
    }
    if (!isAuthenticated) {
      setPendingAction("create");
      return;
    }
    void doCreate();
  }

  function handleJoinClick() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/multiplayer/join/${code}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">Multiplayer</h1>
        <p className="mt-2 text-sm text-smoke-500">
          Async Leagues: same rules, everyone drafts on their own time. Live Draft Rooms: everyone drafts together,
          turn by turn, in real time. Either way — each XI plays its own season, best points total tops the table.
        </p>
      </div>

      {isAuthenticated && (
        <section className="space-y-3">
          <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">My Leagues</h2>
          {loadingMine && <p className="text-center text-sm text-smoke-500">Loading...</p>}
          {!loadingMine && myLeagues && myLeagues.length === 0 && (
            <p className="notch-sm border border-ink-800 bg-ink-900/40 p-4 text-center text-sm text-smoke-500">
              You haven&apos;t joined or created a league yet.
            </p>
          )}
          {myLeagues && myLeagues.length > 0 && (
            <div className="space-y-2">
              {myLeagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => navigate(`/multiplayer/league/${league.id}`)}
                  className="notch-sm flex w-full items-center justify-between border border-ink-800 bg-ink-900/50 px-4 py-3 text-left transition hover:border-mint-500/60"
                >
                  <span className="font-semibold text-paper">{league.name}</span>
                  <span className="text-xs text-smoke-500">
                    {league.rules.difficulty} &middot; {league.rules.formationFreedom ? "any formation" : league.rules.formation}
                  </span>
                </button>
              ))}
            </div>
          )}

          {myLiveRooms && myLiveRooms.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-smoke-600">Live Draft Rooms</h3>
              {myLiveRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => navigate(`/multiplayer/live/${room.id}`)}
                  className="notch-sm flex w-full items-center justify-between border border-ink-800 bg-ink-900/50 px-4 py-3 text-left transition hover:border-plum-500/60"
                >
                  <span className="font-semibold text-paper">{room.league.name}</span>
                  <span className="text-xs text-smoke-500">
                    {room.status === "LOBBY" ? "In lobby" : room.status === "IN_PROGRESS" ? "Drafting live" : "Complete"} &middot;{" "}
                    {room.participants.length}/{room.maxSeats}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="notch space-y-3 border border-ink-800 bg-ink-900/50 p-5 text-center">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">Have an invite code?</h2>
        <div className="mx-auto flex max-w-xs items-center gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. AB3D9FGH"
            maxLength={8}
            className="notch-sm w-full border border-ink-800 bg-ink-950 px-3 py-2 text-center text-sm uppercase tracking-widest text-paper outline-none focus:border-mint-500/60"
          />
          <Button size="sm" onClick={handleJoinClick} disabled={!joinCode.trim()}>
            Join
          </Button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-ink-800 pb-2">
          <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">
            {roomKind === "live" ? "Create a Live Draft Room" : "Create a League"}
          </h2>
          <SegmentedControl<"async" | "live">
            accent="plum"
            columns={2}
            value={roomKind}
            onChange={setRoomKind}
            options={[
              { value: "async", label: "Async" },
              { value: "live", label: "Live" },
            ]}
          />
        </div>
        <p className="text-xs text-smoke-500">
          {roomKind === "live"
            ? "Everyone drafts together, turn by turn, in real time — then each of you simulates your own season."
            : "Everyone drafts independently, whenever they want — then each of you simulates your own season."}
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={roomKind === "live" ? "Room name" : "League name"}
          maxLength={40}
          className="notch-sm w-full border border-ink-800 bg-ink-950 px-4 py-2.5 text-sm text-paper outline-none focus:border-mint-500/60"
        />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">League (shared by every member)</p>
          <LeaguePicker leagues={leagues} selectedIds={leagueIds} onChange={setLeagueIds} singleSelect />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">Difficulty (shared)</p>
          <SegmentedControl<Difficulty>
            accent="crimson"
            columns={3}
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: "easy", label: "Easy", description: "3 redraws" },
              { value: "normal", label: "Normal", description: "1 redraw" },
              { value: "hard", label: "Hard", description: "No redraws" },
            ]}
          />
        </div>

        {roomKind === "live" ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">Formation (shared — a live draft always locks one)</p>
            <FormationPicker value={formation} onChange={(f) => isFormation(f) && setFormation(f)} />
            <p className="text-xs font-semibold uppercase tracking-widest text-smoke-500">Max Players</p>
            <SegmentedControl<string>
              accent="teal"
              columns={3}
              value={String(maxSeats)}
              onChange={(v) => setMaxSeats(Number(v))}
              options={[
                { value: "2", label: "2" },
                { value: "3", label: "3" },
                { value: "4", label: "4" },
              ]}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Toggle
              accent="teal"
              label="Formation Freedom"
              description="On = every member picks their own formation. Off = one fixed formation for the whole league."
              checked={formationFreedom}
              onChange={setFormationFreedom}
            />
            {!formationFreedom && (
              <FormationPicker value={formation} onChange={(f) => isFormation(f) && setFormation(f)} />
            )}
          </div>
        )}

        {createError && <p className="text-center text-sm text-crimson-400">{createError}</p>}

        <Button fullWidth size="lg" disabled={creating} onClick={handleCreateClick}>
          {creating ? "Creating..." : roomKind === "live" ? "Create Room & Get Invite Link" : "Create League & Get Invite Link"}
        </Button>
      </section>

      {pendingAction && (
        <GuestGateModal
          onCancel={() => setPendingAction(null)}
          onDone={() => {
            setPendingAction(null);
            if (pendingAction === "create") void doCreate();
          }}
        />
      )}
    </div>
  );
}
