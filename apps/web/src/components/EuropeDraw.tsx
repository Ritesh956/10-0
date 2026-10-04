import { motion } from "framer-motion";
import type { EuropeDrawDto, FixtureDto, KnockoutTieDto, WorldClubDto } from "../api/types";
import { worldClubLabel } from "../lib/clubNames";
import { staggerContainer, staggerItem } from "../lib/motion";
import { CountryFlag } from "./CountryFlag";
import { Button } from "./ui/Button";

interface Props {
  draw: EuropeDrawDto;
  clubs: WorldClubDto[];
  userClubId: string | undefined;
  /** The league phase's fixtures — the user's eight are listed under the pots. */
  fixtures: FixtureDto[];
  /** The Continental Cup draw: a straight knockout, so it lists the user's first tie, not eight league games. */
  cup?: { ties: KnockoutTieDto[] } | undefined;
  onContinue: () => void;
}

/** The European Nights draw: four pots seeded by squad strength, then the user's eight opponents. */
export function EuropeDraw({ draw, clubs, userClubId, fixtures, cup, onContinue }: Props) {
  const nameFor = (clubId: string) => worldClubLabel(clubs.find((c) => c.id === clubId), clubId);
  const byClub = new Map(draw.clubs.map((c) => [c.clubId, c]));
  const pots = [1, 2, 3, 4].map((pot) => ({ pot, clubs: draw.clubs.filter((c) => c.pot === pot) }));
  const leagues = new Set(draw.clubs.map((c) => c.country)).size;

  const myTie = cup && userClubId ? cup.ties.find((t) => t.homeClubId === userClubId || t.awayClubId === userClubId) : undefined;
  const mine = userClubId && !cup
    ? fixtures
        .filter((f) => f.homeClubId === userClubId || f.awayClubId === userClubId)
        .sort((a, b) => a.matchday - b.matchday)
        .map((f) => {
          const home = f.homeClubId === userClubId;
          const opponentId = home ? f.awayClubId : f.homeClubId;
          return { id: f.id, home, opponentId, opponent: byClub.get(opponentId) };
        })
    : [];

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">
          {cup ? "Continental Cup" : "European Nights"}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-paper">The Draw</h2>
        <p className="mt-1 text-sm text-smoke-400">
          {draw.clubs.length} clubs from {leagues} leagues &middot;{" "}
          {cup ? "straight knockout, two legs a tie" : "8 games each · two opponents from every pot"}
        </p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        {pots.map(({ pot, clubs: potClubs }) => (
          <motion.div key={pot} variants={staggerItem} className="notch border border-ink-800 bg-ink-900/40 p-3">
            <p className="mb-2 flex items-baseline justify-between font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">
              <span>{cup ? `Seeds ${(pot - 1) * 4 + 1}–${pot * 4}` : `Pot ${pot}`}</span>
              <span className="text-[10px] font-normal normal-case tracking-normal text-smoke-600">rating</span>
            </p>
            <ul className="space-y-1">
              {potClubs.map((c) => (
                <li
                  key={c.clubId}
                  className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-sm ${
                    c.clubId === userClubId ? "bg-mint-500/10 font-semibold text-mint-300" : "text-paper"
                  }`}
                >
                  <CountryFlag country={c.country} />
                  <span className="min-w-0 flex-1 truncate">
                    {nameFor(c.clubId)}
                    {c.clubId === userClubId && <span className="ml-1 text-[10px] font-normal text-mint-400">(You)</span>}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-smoke-500">{c.strength}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {mine.length > 0 && (
        <motion.div variants={staggerItem} className="notch border border-mint-500/30 bg-mint-500/5 p-4">
          <p className="mb-2 text-center font-display text-xs font-semibold uppercase tracking-widest text-mint-300">
            Your league phase
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {mine.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-paper">
                <span
                  className={`w-6 shrink-0 text-center text-[10px] font-bold uppercase ${m.home ? "text-mint-300" : "text-smoke-500"}`}
                >
                  {m.home ? "H" : "A"}
                </span>
                <CountryFlag country={m.opponent?.country} />
                <span className="min-w-0 flex-1 truncate">{nameFor(m.opponentId)}</span>
                {m.opponent && <span className="shrink-0 text-[10px] uppercase text-smoke-600">Pot {m.opponent.pot}</span>}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {myTie && userClubId && (
        <motion.div variants={staggerItem} className="notch border border-mint-500/30 bg-mint-500/5 p-4 text-center">
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-widest text-mint-300">Your first tie</p>
          <p className="flex items-center justify-center gap-2 text-sm text-paper">
            {(() => {
              const opponentId = myTie.homeClubId === userClubId ? myTie.awayClubId : myTie.homeClubId;
              const opponent = byClub.get(opponentId);
              // The weaker seed hosts leg one; the stronger seed hosts the decisive second leg.
              const firstLegHome = myTie.awayClubId === userClubId;
              return (
                <>
                  <CountryFlag country={opponent?.country} />
                  <span>
                    vs {nameFor(opponentId)} <span className="text-smoke-500">· seed {opponent?.seed}</span>
                  </span>
                  <span className="text-[10px] uppercase text-smoke-600">{firstLegHome ? "home first" : "away first"}</span>
                </>
              );
            })()}
          </p>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="text-center">
        <Button onClick={onContinue}>{cup ? "Start the Cup" : "Play the league phase"} &rarr;</Button>
      </motion.div>
    </motion.div>
  );
}
