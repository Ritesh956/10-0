import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { LeagueDto, LeagueStandingsRowDto, MultiplayerLeagueDto } from "../api/types";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/auth-context";
import { isFormation } from "../lib/formations";
import { useDraft } from "../state/DraftContext";

const STATUS_LABEL: Record<LeagueStandingsRowDto["status"], string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  complete: "Complete",
};

/** League standings + invite-sharing page (Phase 9a). Standings rank members by their own
    independently-simulated season's points (LeaguesService.getStandings, joined to LeaderboardEntry
    by worldId) — there's no shared fixture list to poll, so a manual refresh is enough; nothing here
    needs to auto-update live. */
export function LeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setConfig, setWorldId, resetDraft } = useDraft();

  const [league, setLeague] = useState<MultiplayerLeagueDto | null>(null);
  const [leagueNames, setLeagueNames] = useState<LeagueDto[]>([]);
  const [standings, setStandings] = useState<LeagueStandingsRowDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function load() {
    if (!leagueId) return;
    setError(null);
    void api
      .getLeague(leagueId)
      .then((l) => {
        setLeague(l);
        void api.listLeagues(l.rules.eraId).then(setLeagueNames);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load this league"));
    void api
      .getLeagueStandings(leagueId)
      .then(setStandings)
      .catch(() => setStandings([]));
  }

  useEffect(load, [leagueId]);

  function startMyDraft() {
    if (!league) return;
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
  }

  function resumeMySeason(worldId: string) {
    setWorldId(worldId);
    navigate("/season");
  }

  if (error) return <div className="mx-auto max-w-md px-6 py-24 text-center text-crimson-400">{error}</div>;
  if (!league || !standings) return <div className="mx-auto max-w-md px-6 py-24 text-center text-smoke-500">Loading league...</div>;

  const inviteUrl = `${window.location.origin}/multiplayer/join/${league.inviteCode}`;
  const leagueNameList = league.rules.leagueIds
    .map((id) => leagueNames.find((l) => l.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  const myRow = standings.find((r) => r.userId === user?.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-plum-400">League</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">{league.name}</h1>
        <p className="mt-2 text-sm text-smoke-500">
          {leagueNameList.join(", ") || "—"} &middot; <span className="capitalize">{league.rules.difficulty}</span> &middot;{" "}
          {league.rules.formationFreedom ? "Any formation" : league.rules.formation}
        </p>
      </div>

      <div className="notch flex flex-wrap items-center justify-between gap-3 border border-ink-800 bg-ink-900/50 p-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-smoke-600">Invite link</p>
          <p className="truncate text-sm text-paper">{inviteUrl}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(inviteUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      {myRow && myRow.status === "not-started" && (
        <Button fullWidth size="lg" onClick={startMyDraft}>
          Draft Your XI →
        </Button>
      )}
      {myRow && myRow.worldId && myRow.status !== "complete" && (
        <Button fullWidth size="lg" onClick={() => resumeMySeason(myRow.worldId!)}>
          Continue My Season →
        </Button>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">Standings</h2>
          <button onClick={load} className="text-xs text-smoke-500 underline hover:text-smoke-400">
            Refresh
          </button>
        </div>
        <div className="overflow-hidden notch border border-ink-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 bg-ink-900/60 text-left text-xs uppercase tracking-wide text-smoke-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Club</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-3 py-2 text-right">Record</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const isMe = row.userId === user?.id;
                return (
                  <tr key={row.userId} className={`border-b border-ink-800/60 last:border-0 ${isMe ? "bg-mint-500/5" : ""}`}>
                    <td className="px-3 py-2 font-display font-bold text-paper">{row.rank ?? "—"}</td>
                    <td className="px-3 py-2 text-paper">
                      {row.entry?.handle ?? "—"} {isMe && <span className="text-xs text-mint-400">(You)</span>}
                    </td>
                    <td className="px-3 py-2 text-smoke-500">{row.entry?.clubName ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-display font-bold text-paper">{row.entry?.points ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-xs text-smoke-500">
                      {row.entry ? `${row.entry.won}W ${row.entry.drawn}D ${row.entry.lost}L` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-smoke-500">{STATUS_LABEL[row.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
