import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { KnockoutRound, KnockoutTieDto, NationsCupGroupDto, StandingsDto, WorldClubDto } from "../api/types";
import { fireChampionShower } from "../lib/confetti";
import { worldClubLabel } from "../lib/clubNames";
import { KnockoutBracket } from "./KnockoutBracket";
import { StandingsTable } from "./StandingsTable";
import { Button } from "./ui/Button";
import { useT } from "../lib/i18n/context";

interface Props {
  worldId: string;
  /** The domestic season, so the run can be finalised again once the cup has a winner (trophy). */
  domesticSeasonId: string | undefined;
  userClubId: string | undefined;
  /** Called with any trophies the finished cup unlocked. */
  onTrophies?: (keys: string[]) => void;
}

type Stage = "idle" | "starting" | "groups" | "knockouts" | "done" | "error";

const KNOCKOUT_ORDER: KnockoutRound[] = ["QF", "SF", "FINAL"];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The first knockout round that still has an undecided tie (null when the Final is decided). */
export function pendingRound(ties: KnockoutTieDto[]): KnockoutRound | null {
  for (const round of KNOCKOUT_ORDER) {
    const inRound = ties.filter((t) => t.round === round);
    if (inRound.length > 0 && inRound.some((t) => !t.winnerClubId)) return round;
  }
  return null;
}

/** True once every tie of a round has had its legs played (a score exists). */
export function roundPlayed(ties: KnockoutTieDto[], round: KnockoutRound): boolean {
  const inRound = ties.filter((t) => t.round === round);
  return inRound.length > 0 && inRound.every((t) => t.score !== null && t.score !== undefined);
}

/**
 * The Nations Cup, offered on the results screen: take this XI to a 16-side tournament against
 * national teams built from the best players of each nationality — four groups, then single-leg
 * knockouts. The panel drives the whole thing itself (start, wait for the worker, advance each
 * round) and can pick a half-played cup back up.
 */
export function NationsCupPanel({ worldId, domesticSeasonId, userClubId, onTrophies }: Props) {
  const { t } = useT();
  const [stage, setStage] = useState<Stage>("idle");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clubs, setClubs] = useState<WorldClubDto[]>([]);
  const [groups, setGroups] = useState<NationsCupGroupDto[]>([]);
  const [ties, setTies] = useState<KnockoutTieDto[]>([]);
  const [champion, setChampion] = useState<string | null>(null);
  const [resumable, setResumable] = useState(false);
  const running = useRef(false);

  // A cup started earlier (this browser or another): show it finished, or offer to carry on.
  useEffect(() => {
    let cancelled = false;
    void api
      .getNationsCupStatus(worldId)
      .then(async (status) => {
        if (cancelled || !status.started) return;
        const [world, bracket, tables] = await Promise.all([
          api.getWorld(worldId),
          api.getEuropeBracket(worldId, status.competitionId),
          status.groupSeasonId ? api.getNationsCupGroups(worldId, status.groupSeasonId) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setClubs(world.clubs);
        setGroups(tables);
        setTies(bracket);
        if (status.champion) {
          setChampion(status.champion);
          setStage("done");
        } else {
          setResumable(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  async function run() {
    if (running.current) return;
    running.current = true;
    setError(null);
    setResumable(false);
    try {
      setStage("starting");
      setLabel("Building the national teams…");
      const started = await api.startNationsCup(worldId);
      setClubs((await api.getWorld(worldId)).clubs);
      setGroups(started.groups);
      const competitionId = started.competitionId;

      setStage("groups");
      setLabel("Playing the group stage…");
      for (;;) {
        const season = await api.getSeason(worldId, started.seasonId);
        if (season.status === "COMPLETED") break;
        await sleep(1200);
      }
      setGroups(await api.getNationsCupGroups(worldId, started.seasonId));
      await sleep(3500);

      setStage("knockouts");
      let bracket = await api.getEuropeBracket(worldId, competitionId);
      if (bracket.length === 0) {
        await api.startNationsCupKnockouts(worldId, competitionId);
        bracket = await api.getEuropeBracket(worldId, competitionId);
      }
      setTies(bracket);
      for (;;) {
        const round = pendingRound(bracket);
        if (!round) break;
        setLabel(`Playing the ${round === "QF" ? "quarter-finals" : round === "SF" ? "semi-finals" : "Final"}…`);
        while (!roundPlayed(bracket, round)) {
          await sleep(1200);
          bracket = await api.getEuropeBracket(worldId, competitionId);
          setTies(bracket);
        }
        await api.advanceEuropeKnockouts(worldId, competitionId, round);
        bracket = await api.getEuropeBracket(worldId, competitionId);
        setTies(bracket);
        await sleep(1800);
      }

      const final = bracket.find((t) => t.round === "FINAL");
      setChampion(final?.winnerClubId ?? null);
      setStage("done");
      if (final?.winnerClubId && final.winnerClubId === userClubId) fireChampionShower();
      if (domesticSeasonId && userClubId) {
        const result = await api.finalizeRun(worldId, domesticSeasonId).catch(() => null);
        if (result) onTrophies?.(result.trophies);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Nations Cup hit a problem");
      setStage("error");
    } finally {
      running.current = false;
    }
  }

  const nameFor = (clubId: string) => worldClubLabel(clubs.find((c) => c.id === clubId), clubId);
  const asStandings = (g: NationsCupGroupDto): StandingsDto => ({ seasonId: `group-${g.letter}`, rows: g.rows });

  return (
    <section className="notch space-y-4 border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-ink-900 to-ink-950 p-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">Bonus</p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-paper">{t("nationsCup.title")}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-smoke-400">
          {t("nationsCup.intro")}
        </p>
      </div>

      {(stage === "idle" || stage === "error") && (
        <div className="text-center">
          {error && <p className="mb-2 text-sm text-crimson-400">{error}</p>}
          <Button onClick={() => void run()}>{t(resumable ? "nationsCup.carryOn" : "nationsCup.enter")} &rarr;</Button>
        </div>
      )}

      {(stage === "starting" || stage === "groups" || stage === "knockouts") && (
        <p className="animate-mint-pulse text-center text-sm text-smoke-500">{label}</p>
      )}

      {groups.length > 0 && stage !== "idle" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.letter}>
              <p className="mb-1 text-center font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">
                {t("nationsCup.group", { letter: g.letter })}
              </p>
              <StandingsTable standings={asStandings(g)} clubs={clubs} highlightClubId={userClubId} />
            </div>
          ))}
        </div>
      )}

      {ties.length > 0 && stage !== "idle" && <KnockoutBracket ties={ties} clubs={clubs} highlightClubId={userClubId} />}

      {stage === "done" && champion && (
        <p className="text-center font-display text-lg font-bold uppercase tracking-wide text-amber-300">
          {champion === userClubId ? t("nationsCup.worldChampions") : `${nameFor(champion)} win the Nations Cup`}
        </p>
      )}
    </section>
  );
}
