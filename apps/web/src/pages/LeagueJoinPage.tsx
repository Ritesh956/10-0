import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { LeagueDto, MultiplayerLeagueDto } from "../api/types";
import { GuestGateModal } from "../components/GuestGateModal";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth-context";
import { isFormation } from "../lib/formations";
import { useDraft } from "../state/DraftContext";

/** Join-by-invite-link landing page (Phase 9a) — previews a league's locked rules (no sign-in
    required, matches catalog/leaderboard's openly-readable convention) before committing to
    joining. Mirrors ClubsDirectoryPage's "lock config, route through /setup" pattern for One-Club
    XI — everything NOT locked by the league (ratings visibility, draft mode, managers, toggles) is
    still configurable there. */
export function LeagueJoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { setConfig, resetDraft } = useDraft();

  const [league, setLeague] = useState<MultiplayerLeagueDto | null>(null);
  const [leagueNames, setLeagueNames] = useState<LeagueDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  useEffect(() => {
    if (!code) return;
    void api
      .previewLeagueInvite(code)
      .then((l) => {
        setLeague(l);
        return api.listLeagues(l.rules.eraId);
      })
      .then(setLeagueNames)
      .catch((err) => setError(err instanceof Error ? err.message : "This invite link isn't valid"));
  }, [code]);

  async function doJoin() {
    if (!code || !league) return;
    setJoining(true);
    setError(null);
    try {
      await api.joinLeague(code);
      resetDraft();
      setConfig({
        eraId: league.rules.eraId,
        leagueIds: league.rules.leagueIds,
        difficulty: league.rules.difficulty,
        formation: league.rules.formation && isFormation(league.rules.formation) ? league.rules.formation : "4-3-3",
        multiplayerLeagueId: league.id,
        multiplayerLeagueName: league.name,
        multiplayerFormationLocked: !league.rules.formationFreedom,
        eraYearMin: undefined,
        eraYearMax: undefined,
        lockedClubId: undefined,
        lockedClubName: undefined,
      });
      navigate("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join the league");
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

  if (error && !league) {
    return <div className="mx-auto max-w-md px-6 py-24 text-center text-crimson-400">{error}</div>;
  }
  if (!league) {
    return <div className="mx-auto max-w-md px-6 py-24 text-center text-smoke-500">Loading invite...</div>;
  }

  const leagueNameList = league.rules.leagueIds
    .map((id) => leagueNames.find((l) => l.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-plum-400">You're invited</p>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">{league.name}</h1>

      <div className="notch space-y-2 border border-ink-800 bg-ink-900/50 p-5 text-left text-sm">
        <p className="flex justify-between">
          <span className="text-smoke-500">League</span>
          <span className="font-semibold text-paper">{leagueNameList.join(", ") || "—"}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-smoke-500">Difficulty</span>
          <span className="font-semibold capitalize text-paper">{league.rules.difficulty}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-smoke-500">Formation</span>
          <span className="font-semibold text-paper">{league.rules.formationFreedom ? "Your choice" : league.rules.formation}</span>
        </p>
      </div>

      <p className="text-sm text-smoke-500">
        Draft your own XI under these rules, then simulate your own season — best points total tops the table.
      </p>

      {error && <p className="text-sm text-crimson-400">{error}</p>}

      <Button size="lg" fullWidth disabled={joining} onClick={handleJoinClick}>
        {joining ? "Joining..." : "Join & Draft →"}
      </Button>

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
