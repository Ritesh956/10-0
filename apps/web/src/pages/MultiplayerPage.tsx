import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ClubSeasonDto, EraDto, LeagueDto, PlayerSeasonDto, StandingsRowDto } from "../api/types";
import { DrawReel } from "../components/DrawReel";
import { FormationPicker } from "../components/FormationPicker";
import { GuestGateModal } from "../components/GuestGateModal";
import { LeaguePicker } from "../components/LeaguePicker";
import { PlayerPickCard } from "../components/PlayerPickCard";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth-context";
import { type Formation } from "../lib/formations";

interface SquadResult {
  label: string;
  squadName: string;
  clubSeason: ClubSeasonDto;
  refPlayerSeasonIds: string[];
}

function SquadDraftPanel({
  label,
  eraId,
  leagueIds,
  onComplete,
}: {
  label: string;
  eraId: string;
  leagueIds: string[];
  onComplete: (result: Omit<SquadResult, "label">) => void;
}) {
  const [squadName, setSquadName] = useState(`${label}'s XI`);
  const [clubSeason, setClubSeason] = useState<ClubSeasonDto | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [players, setPlayers] = useState<PlayerSeasonDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function spin() {
    setSpinning(true);
    setError(null);
    try {
      const club = await api.rollClubSeason({ eraId, leagueIds });
      setClubSeason(club);
      const pool = await api.listPlayerSeasons({ clubSeasonId: club.id });
      setPlayers(pool);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No club seasons match those filters");
    } finally {
      setSpinning(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 23) next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-plum-400">{label}'s turn</p>
        <input
          value={squadName}
          onChange={(e) => setSquadName(e.target.value)}
          className="notch-sm mt-2 w-full max-w-xs border-2 border-ink-700 bg-ink-950 px-3 py-2 text-center text-sm text-paper outline-none focus:border-gold-500"
        />
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      {!clubSeason ? (
        <DrawReel spinning={spinning} onSpin={() => void spin()} />
      ) : (
        <div className="space-y-3">
          <p className="text-center text-sm text-smoke-500">
            {clubSeason.club.name} {clubSeason.seasonYear} &middot;{" "}
            <button className="underline hover:text-smoke-400" onClick={() => void spin()}>
              redraw
            </button>
          </p>
          <p className="text-center text-xs text-ink-600">{selected.size}/23 selected (need 11+)</p>
          <div className="grid max-h-72 gap-2 overflow-y-auto scrollbar-thin pr-1 sm:grid-cols-2">
            {players.map((player) => (
              <PlayerPickCard
                key={player.id}
                player={player}
                showRatings
                selected={selected.has(player.id)}
                onClick={() => toggle(player.id)}
              />
            ))}
          </div>
          <Button
            fullWidth
            disabled={selected.size < 11}
            onClick={() =>
              onComplete({ squadName, clubSeason, refPlayerSeasonIds: [...selected] })
            }
          >
            Confirm {label}'s squad &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}

type Phase = "intro" | "draft-a" | "pass-device" | "draft-b" | "simulating" | "result";

export function MultiplayerPage() {
  const { isAuthenticated } = useAuth();
  const [phase, setPhase] = useState<Phase>("intro");
  const [eras, setEras] = useState<EraDto[]>([]);
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [eraId, setEraId] = useState("");
  const [leagueIds, setLeagueIds] = useState<string[]>([]);
  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [showGuestGate, setShowGuestGate] = useState(false);

  const [squadA, setSquadA] = useState<SquadResult | null>(null);
  const [squadB, setSquadB] = useState<SquadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<{ clubName: string; row: StandingsRowDto }[] | null>(null);

  useEffect(() => {
    void api.listEras().then((list) => {
      setEras(list);
      if (list[0]) setEraId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!eraId) return;
    void api.listLeagues(eraId).then(setLeagues).catch(() => setLeagues([]));
  }, [eraId]);

  async function runHeadToHead(a: SquadResult, b: SquadResult) {
    setPhase("simulating");
    setError(null);
    try {
      const world = await api.createWorld(eraId);
      await api.draftFantasy(world.id, a.squadName, formation, a.refPlayerSeasonIds);
      await api.draftFantasy(world.id, b.squadName, formation, b.refPlayerSeasonIds);
      const refreshedWorld = await api.getWorld(world.id);
      const season = await api.createSeason(world.id, "Head-to-Head", 2);
      await api.simulateSeason(world.id, season.id);
      let latest = season;
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        latest = await api.getSeason(world.id, season.id);
        if (latest.status === "COMPLETED") break;
      }
      const standings = await api.getStandings(world.id, season.id);
      const named = standings.rows.map((row) => ({
        clubName: refreshedWorld.clubs.find((c) => c.id === row.clubId)?.name ?? "Unknown",
        row,
      }));
      setRows(named);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Head-to-head simulation failed");
      setPhase("draft-b");
    }
  }

  function handleBothDrafted(a: SquadResult, b: SquadResult) {
    if (!isAuthenticated) {
      setSquadA(a);
      setSquadB(b);
      setShowGuestGate(true);
      return;
    }
    void runHeadToHead(a, b);
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-12 text-center">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">Head to Head</h1>
          <p className="mt-2 text-sm text-smoke-500">Same rules, your XI against theirs. Whoever's higher on the table wins.</p>
        </div>
        <p className="text-sm text-smoke-600">
          Pass-and-play: Player A drafts an XI, then hands the device to Player B. Both squads play a two-leg
          fixture and the higher points total wins.
        </p>

        <div className="space-y-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">Shared league</p>
          <LeaguePicker leagues={leagues} selectedIds={leagueIds} onChange={setLeagueIds} />
        </div>

        <div className="space-y-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-smoke-600">Shared formation</p>
          <FormationPicker value={formation} onChange={setFormation} />
        </div>

        <Button size="lg" fullWidth disabled={!eraId} onClick={() => setPhase("draft-a")}>
          Start: Player A drafts &rarr;
        </Button>
      </div>
    );
  }

  if (phase === "draft-a") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <SquadDraftPanel
          label="Player A"
          eraId={eraId}
          leagueIds={leagueIds}
          onComplete={(result) => {
            setSquadA({ label: "Player A", ...result });
            setPhase("pass-device");
          }}
        />
      </div>
    );
  }

  if (phase === "pass-device") {
    return (
      <div className="mx-auto max-w-md space-y-6 px-6 py-24 text-center">
        <p className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Pass the device to Player B</p>
        <p className="text-sm text-smoke-500">Player A's XI is locked in. Player B, when you're ready...</p>
        <Button size="lg" onClick={() => setPhase("draft-b")}>
          I'm Player B, let's go &rarr;
        </Button>
      </div>
    );
  }

  if (phase === "draft-b") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        {error && <p className="mb-4 text-center text-sm text-crimson-400">{error}</p>}
        <SquadDraftPanel
          label="Player B"
          eraId={eraId}
          leagueIds={leagueIds}
          onComplete={(result) => {
            const b = { label: "Player B", ...result };
            setSquadB(b);
            if (squadA) handleBothDrafted(squadA, b);
          }}
        />
        {showGuestGate && (
          <GuestGateModal
            onCancel={() => setShowGuestGate(false)}
            onDone={() => {
              setShowGuestGate(false);
              if (squadA && squadB) void runHeadToHead(squadA, squadB);
            }}
          />
        )}
      </div>
    );
  }

  if (phase === "simulating") {
    return <p className="px-6 py-24 text-center text-smoke-500">Simulating the fixture...</p>;
  }

  if (phase === "result" && rows) {
    const [rowA, rowB] = rows;
    const winner =
      !rowA || !rowB
        ? null
        : rowA.row.points === rowB.row.points
          ? "Draw"
          : rowA.row.points > rowB.row.points
            ? rowA.clubName
            : rowB.clubName;

    return (
      <div className="mx-auto max-w-xl space-y-6 px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-plum-400">Result</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">
          {winner === "Draw" ? "It's a draw!" : `${winner} wins!`}
        </h1>
        <div className="grid grid-cols-2 gap-4">
          {rows.map(({ clubName, row }) => (
            <div key={clubName} className="notch border-2 border-ink-700 bg-ink-900/60 p-5">
              <p className="font-semibold text-paper">{clubName}</p>
              <p className="mt-2 font-display text-3xl font-bold text-gold-400">{row.points}</p>
              <p className="text-xs text-smoke-500">points</p>
              <p className="mt-3 text-xs text-smoke-500">
                {row.won}W {row.drawn}D {row.lost}L &middot; {row.goalsFor}-{row.goalsAgainst}
              </p>
            </div>
          ))}
        </div>
        <Button
          onClick={() => {
            setPhase("intro");
            setSquadA(null);
            setSquadB(null);
            setRows(null);
          }}
        >
          Play again
        </Button>
      </div>
    );
  }

  return null;
}
