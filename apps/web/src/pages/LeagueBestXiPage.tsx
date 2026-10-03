import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { BestXiPlayerDto, BestXiSlotDto } from "../api/types";
import { CountryFlag } from "../components/CountryFlag";
import { SiteFooter } from "../components/SiteFooter";
import { Button } from "../components/ui/Button";
import { clubDisplayName } from "../lib/clubNames";
import { LEAGUE_SLUGS, leagueCountry, leagueIdForSlug, leagueInSentence, leagueLabel } from "../lib/leagues";
import { POSITION_GROUP, type Position } from "../lib/formations";
import { GROUP_TEXT, initials } from "../lib/positionColors";
import { formatSeason } from "../lib/season";
import { useDraft } from "../state/DraftContext";
import { NotFoundPage } from "./NotFoundPage";

/** One line of editorial context per league — our own summary of the era the data covers. */
const INTROS: Record<string, string> = {
  "league-gb1":
    "Guardiola's City, Klopp's Liverpool and Leicester's 5000-to-1 title: thirteen seasons of the Premier League, boiled down to one XI.",
  "league-es1":
    "The last great Messi–Ronaldo duel, Simeone's two titles for Atlético and Real Madrid's European dynasty — LaLiga's best, side by side.",
  "league-it1":
    "Juventus's nine titles in a row, Napoli's 2022/23 Scudetto and the Milan clubs' revival: Serie A's finest from every corner.",
  "league-l1":
    "Bayern's eleven straight titles, Dortmund's pressing machines and Leverkusen's unbeaten 2023/24, distilled into one Bundesliga XI.",
  "league-fr1":
    "PSG's superteams, Monaco's 2016/17 kids and Lille's 2020/21 upset — the best of Ligue 1 across the whole archive.",
};

/** Team-sheet lines, attack first, in left-to-right order. */
const LINES: { label: string; slots: number[] }[] = [
  { label: "Attack", slots: [10, 9, 8] },
  { label: "Midfield", slots: [5, 6, 7] },
  { label: "Defence", slots: [4, 3, 2, 1] },
  { label: "Goalkeeper", slots: [0] },
];

function PlayerCard({ slot, player, alternatives }: { slot: string; player: BestXiPlayerDto; alternatives: BestXiPlayerDto[] }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const groupText = GROUP_TEXT[POSITION_GROUP[slot as Position] ?? "MID"];
  return (
    <div className="notch flex flex-col gap-2 border border-ink-800 bg-ink-900/50 p-3">
      <div className="flex items-center gap-3">
        {player.photoUrl && !photoFailed ? (
          <img
            src={player.photoUrl}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="h-12 w-12 shrink-0 rounded-full bg-ink-800 object-cover object-top"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-800 font-display text-sm font-bold text-smoke-400">
            {initials(player.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight text-paper">{player.name}</p>
          <p className="text-xs leading-snug text-smoke-500">
            {clubDisplayName(player.clubName)} · {formatSeason(player.seasonYear)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold text-mint-400">{player.overall}</p>
          <p className={`text-[10px] font-semibold uppercase ${groupText}`}>{slot}</p>
        </div>
      </div>
      {alternatives.length > 0 && (
        <p className="text-[11px] leading-snug text-smoke-500">
          <span className="text-smoke-600">Also: </span>
          {alternatives.map((a) => `${a.name} (${a.overall})`).join(", ")}
        </p>
      )}
    </div>
  );
}

/** "/best-xi/:league" — a league's top-rated XI by our own ratings, with alternatives per slot.
    Five pages of crawlable, linkable content from data the draft already has (P2 SEO item). */
export function LeagueBestXiPage() {
  const { league: slug } = useParams();
  const leagueId = leagueIdForSlug(slug);
  const navigate = useNavigate();
  const { setConfig } = useDraft();
  const [slots, setSlots] = useState<BestXiSlotDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    setSlots(null);
    setError(null);
    api
      .getBestXi(leagueId)
      .then(setSlots)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this XI"));
  }, [leagueId]);

  if (!leagueId) return <NotFoundPage />;
  const name = leagueLabel(leagueId);

  function draftFromLeague() {
    setConfig({ leagueIds: [leagueId!] });
    navigate("/setup");
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-xs text-smoke-500">
          <Link to="/" className="hover:text-paper">
            Home
          </Link>{" "}
          ›{" "}
          <Link to="/best-xi" className="hover:text-paper">
            Best XI
          </Link>{" "}
          › <span className="text-smoke-400">{name}</span>
        </nav>

        <header className="space-y-3">
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold uppercase leading-tight tracking-tight text-paper sm:text-4xl">
            <CountryFlag country={leagueCountry(leagueId)} className="h-5 w-[30px]" />
            The greatest {name} XI
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-smoke-400">{INTROS[leagueId]}</p>
          <p className="text-xs text-smoke-600">
            Picked by our own ratings, 2012/13–2025/26: each player at their best {name} season, in a 4-3-3. Ties go to
            the more recent season. Every one of them is in the draft pool.
          </p>
          <Button onClick={draftFromLeague}>Draft from {leagueInSentence(leagueId)} &rarr;</Button>
        </header>

        {error && <p className="text-sm text-crimson-400">{error}</p>}
        {!slots && !error && <p className="text-sm text-smoke-500">Picking the XI…</p>}

        {slots &&
          LINES.map((line) => (
            <section key={line.label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-smoke-600">{line.label}</h2>
              <div className={`grid gap-3 sm:grid-cols-2 ${line.slots.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                {line.slots.map((i) => {
                  const s = slots[i];
                  return s?.pick ? <PlayerCard key={i} slot={s.slot} player={s.pick} alternatives={s.alternatives} /> : null;
                })}
              </div>
            </section>
          ))}

        <section className="space-y-2 border-t border-ink-800 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-smoke-600">The other leagues</h2>
          <div className="flex flex-wrap gap-2">
            {LEAGUE_SLUGS.filter((l) => l.leagueId !== leagueId).map((l) => (
              <Link
                key={l.slug}
                to={`/best-xi/${l.slug}`}
                className="notch-sm flex items-center gap-2 border border-ink-700 px-3 py-1.5 text-sm text-smoke-400 hover:border-mint-500/60 hover:text-paper"
              >
                <CountryFlag country={leagueCountry(l.leagueId)} />
                Greatest {leagueLabel(l.leagueId)} XI
              </Link>
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
