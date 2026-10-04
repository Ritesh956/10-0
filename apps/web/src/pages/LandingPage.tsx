import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { SiteStatsDto } from "../api/types";
import { isRealCountry } from "../lib/leagues";
import { formatSeason } from "../lib/season";
import { storedDraftProgress, useDraft } from "../state/DraftContext";
import { LeagueSwitcher } from "../components/LeagueSwitcher";
import { playLeagueIdOf } from "../lib/leagues";
import { rememberLeagueTheme, storedLeagueTheme } from "../lib/leagueTheme";
import { SiteFooter } from "../components/SiteFooter";
import { useT } from "../lib/i18n/context";
import type { MessageKey } from "../lib/i18n";
import { Button } from "../components/ui/Button";

interface ModeCard {
  title: MessageKey;
  description: MessageKey;
  icon: string;
  to: string;
}

/** Phase 10: every shipped mode as a real, clickable card — this used to render only "One-Club
    Legacy"/"Daily Card" as opacity-70 "Not yet" stubs (stale placeholder copy left over from
    before Phases 7/8 actually shipped those modes), and never mentioned Multiplayer or Nations at
    all here. All five modes now link straight to where they actually live. */
const MODE_CARDS: ModeCard[] = [
  {
    title: "mode.classic.title",
    description: "mode.classic.desc",
    icon: "\u{1F3C6}",
    to: "/setup",
  },
  {
    title: "mode.mates.title",
    description: "mode.mates.desc",
    icon: "\u{26BD}",
    to: "/multiplayer",
  },
  {
    title: "mode.events.title",
    description: "mode.events.desc",
    icon: "\u{1F4C5}",
    to: "/events",
  },
  {
    title: "mode.oneClub.title",
    description: "mode.oneClub.desc",
    icon: "\u{1F3DF}\u{FE0F}",
    to: "/clubs",
  },
  {
    title: "mode.daily.title",
    description: "mode.daily.desc",
    icon: "\u{1F5D3}\u{FE0F}",
    to: "/daily",
  },
  {
    title: "mode.nations.title",
    description: "mode.nations.desc",
    icon: "\u{1F30D}",
    to: "/nations",
  },
];

const HOW_IT_WORKS: Array<[string, string]> = [
  ["Set the rules", "Pick one of Europe's top-5 leagues, a formation, and how forgiving the draw should be."],
  ["Draw a name", "Land on a random club and season, then pick a player out of that exact squad."],
  ["Fill the shirt", "Repeat until all 11 spots are taken — redraw if a name doesn't work out."],
  ["Kick off", "Simulate a season and see how close your XI gets to going unbeaten."],
];

const FAQ: Array<[string, string]> = [
  [
    "Is this affiliated with any real league or club?",
    "No. Futbol is an independent fan project. Club, player, and manager names reflect real people and real historical rosters (top-5 European leagues, 2012/13–2025/26), included for factual reference — but all ratings, tactics, and match outcomes are our own calculation, not sourced from or endorsed by any official body.",
  ],
  [
    "Do I need an account to play?",
    "No — you can draft and simulate a full season as a guest. Sign in (or upgrade a guest account) only when you want your trophies, history, and leaderboard runs to persist.",
  ],
  [
    "How is a match actually simulated?",
    "Every match runs through a deterministic engine, minute by minute — player attributes, tactics, fatigue, and momentum all feed into chances, cards, and injuries. The same inputs always produce the same result, so a run is fully reproducible.",
  ],
  [
    "What's the difference between Season and Prime ratings?",
    "Season rates a player exactly as they were in the drawn season. Prime swaps in their career-best season's rating and attributes instead, while keeping the drawn club-season as display context.",
  ],
  [
    "What counts as going unbeaten?",
    "No losses across the whole league season earns Unbeaten. Winning every single match — a true 38-0 record — earns the rarer Invincible trophy instead.",
  ],
];

interface ArchiveStats {
  leagues: number;
  nationalities: number;
  clubs: number;
  seasons: string;
}

/** Live numbers from the real (top-5) catalog. These used to be hard-coded ("12 leagues · 9
    countries · 1992–2025"), which counted the fictional placeholder leagues and contradicted the
    footer's own top-5 disclaimer. */
async function loadArchiveStats(): Promise<ArchiveStats> {
  const eras = await api.listEras();
  const [leagueLists, clubs, nations] = await Promise.all([
    Promise.all(eras.map((e) => api.listLeagues(e.id))),
    api.listClubs(),
    api.listNations(),
  ]);
  const leagues = leagueLists.flat().filter((l) => isRealCountry(l.country));
  const mins = leagues.map((l) => l.minSeasonYear).filter((y): y is number => typeof y === "number");
  const maxes = leagues.map((l) => l.maxSeasonYear).filter((y): y is number => typeof y === "number");
  const seasons = mins.length && maxes.length ? `${formatSeason(Math.min(...mins))}–${formatSeason(Math.max(...maxes))}` : "—";
  return { leagues: leagues.length, nationalities: nations.length, clubs: clubs.length, seasons };
}

const fmt = (n: number) => n.toLocaleString("en-GB");

/** Social proof straight from the database (GET /stats): what players have done so far, and the
    current top of the leaderboard. Hidden until there's at least one finished season. */
function LiveStrip({ stats }: { stats: SiteStatsDto }) {
  const counters = [
    { label: "seasons simulated", value: stats.seasonsSimulated },
    { label: "XIs drafted", value: stats.xisDrafted },
    { label: "matches played", value: stats.matchesPlayed },
  ];
  return (
    <section className="notch mt-12 border border-ink-800 bg-ink-900/50 p-5" aria-label="Live numbers">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-mint-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-mint-400" aria-hidden />
          Live
        </span>
        {counters.map((c) => (
          <p key={c.label} className="text-sm text-smoke-500">
            <span className="font-display text-2xl font-bold text-paper">{fmt(c.value)}</span> {c.label}
          </p>
        ))}
      </div>
      {stats.topRuns.length > 0 && (
        <div className="mt-4 border-t border-ink-800 pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-smoke-600">Top of the leaderboard</p>
            <Link to="/leaderboard" className="text-xs font-semibold uppercase tracking-wide text-mint-400 hover:text-mint-300">
              See all &rarr;
            </Link>
          </div>
          <ol className="mt-2 space-y-1">
            {stats.topRuns.map((r, i) => (
              <li key={`${r.handle}-${i}`} className="flex items-baseline gap-3 text-sm">
                <span className="w-4 font-display font-bold text-smoke-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-paper">{r.handle}</span>
                <span className="hidden text-xs text-smoke-500 sm:inline">{r.leagueName ?? ""}</span>
                <span className="text-xs text-smoke-500">
                  {r.won}-{r.drawn}-{r.lost}
                </span>
                <span className="w-14 text-right font-display font-bold text-mint-400">{r.points} pts</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { config, setConfig } = useDraft();
  const chosenLeague = playLeagueIdOf(config) ?? storedLeagueTheme();
  const [archive, setArchive] = useState<ArchiveStats | null>(null);
  const [live, setLive] = useState<SiteStatsDto | null>(null);
  // An unfinished draft from an earlier visit (persisted by DraftContext) — offer to pick it back up.
  const [draftProgress] = useState(() => {
    const progress = storedDraftProgress();
    return progress && progress.picks < 11 ? progress : null;
  });

  useEffect(() => {
    let cancelled = false;
    loadArchiveStats()
      .then((stats) => {
        if (!cancelled) setArchive(stats);
      })
      .catch(() => {
        // Non-critical decoration — leave the "—" placeholders rather than show an error on the landing page.
      });
    api
      .getSiteStats()
      .then((stats) => {
        if (!cancelled) setLive(stats);
      })
      .catch(() => {
        // Same: social proof is optional, the page works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[3fr_2fr] md:items-center">
          <div>
            <span className="notch-sm inline-flex items-center gap-2 border-2 border-mint-500/30 bg-mint-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
              {t("landing.fanProject")}
            </span>

            <div className="mt-6">
              <LeagueSwitcher
                value={chosenLeague}
                onChange={(id) => {
                  rememberLeagueTheme(id);
                  setConfig({ leagueIds: [id], playLeagueId: undefined, draftPool: undefined });
                }}
              />
            </div>

            <h1 className="mt-6 font-display text-5xl font-bold uppercase leading-[1.05] tracking-tight text-paper sm:text-6xl">
              {t("landing.hero1")}
              <br />
              {t("landing.hero2")}
              <br />
              <span className="bg-gradient-to-r from-mint-300 via-mint-400 to-crimson-400 bg-clip-text text-transparent">
                {t("landing.hero3")}
              </span>
            </h1>

            <p className="mt-6 max-w-md text-sm leading-relaxed text-smoke-500">
              {t("landing.sub")}
            </p>

            {draftProgress && (
              <div className="mt-8">
                <Button size="lg" fullWidth onClick={() => navigate("/draft")}>
                  {t("landing.continue", { n: draftProgress.picks })} &rarr;
                </Button>
              </div>
            )}
            <div className={`${draftProgress ? "mt-3" : "mt-8"} flex flex-col gap-3 sm:flex-row`}>
              <Button size="lg" variant={draftProgress ? "outline" : "primary"} onClick={() => navigate("/setup")}>
                {t("landing.start")} &rarr;
              </Button>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" fullWidth>
                  {t("landing.seeHow")}
                </Button>
              </a>
            </div>
          </div>

          <div className="notch relative overflow-hidden border border-ink-800 bg-ink-900/70 p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_0%,rgba(31,191,117,0.12),transparent)]"
            />
            <p className="relative text-[10px] font-semibold uppercase tracking-[0.3em] text-smoke-600">Archive on file</p>
            <dl className="relative mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Leagues</dt>
                <dd className="font-display text-3xl font-bold text-mint-400">{archive?.leagues ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Nationalities</dt>
                <dd className="font-display text-3xl font-bold text-teal-400">{archive?.nationalities ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Clubs</dt>
                <dd className="font-display text-3xl font-bold text-plum-400">{archive?.clubs ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Seasons</dt>
                <dd className="font-display text-xl font-bold text-crimson-400">{archive?.seasons ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        {live && live.seasonsSimulated > 0 && <LiveStrip stats={live} />}

        <section className="mt-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">Game modes</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODE_CARDS.map((card, i) => {
              const tint = [
                { border: "border-mint-500/25", bg: "bg-mint-500/5" },
                { border: "border-plum-500/25", bg: "bg-plum-500/5" },
                { border: "border-teal-500/25", bg: "bg-teal-500/5" },
                { border: "border-crimson-500/25", bg: "bg-crimson-500/5" },
                { border: "border-mint-500/25", bg: "bg-mint-500/5" },
              ][i % 5]!;
              return (
                <Link
                  key={card.title}
                  to={card.to}
                  className={`notch flex items-center justify-between gap-3 border-2 ${tint.border} bg-ink-900/40 p-5 transition hover:bg-ink-900/70`}
                >
                  <span className="flex items-center gap-4">
                    <span className={`notch-sm flex h-10 w-10 shrink-0 items-center justify-center border ${tint.border} ${tint.bg} text-xl`}>
                      {card.icon}
                    </span>
                    <span>
                      <span className="block font-display font-bold uppercase tracking-wide text-paper">{t(card.title)}</span>
                      <span className="block text-sm text-smoke-500">{t(card.description)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-smoke-600">&rarr;</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="mt-20 scroll-mt-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">How a run works</p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {HOW_IT_WORKS.map(([title, body], i) => {
              const STEP_ACCENT = [
                { border: "border-mint-500/40", bg: "bg-mint-500/10", text: "text-mint-400" },
                { border: "border-teal-500/40", bg: "bg-teal-500/10", text: "text-teal-400" },
                { border: "border-plum-500/40", bg: "bg-plum-500/10", text: "text-plum-400" },
                { border: "border-crimson-500/40", bg: "bg-crimson-500/10", text: "text-crimson-400" },
              ][i % 4]!;
              return (
                <li key={title} className="notch flex gap-4 border border-ink-800 bg-ink-900/40 p-4">
                  <span
                    className={`notch-sm flex h-8 w-8 shrink-0 items-center justify-center border font-display font-bold ${STEP_ACCENT.border} ${STEP_ACCENT.bg} ${STEP_ACCENT.text}`}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-display font-semibold uppercase tracking-wide text-paper">{title}</span>
                    <span className="block text-sm text-smoke-500">{body}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="faq" className="mt-20 scroll-mt-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">FAQ</p>
          <div className="space-y-2">
            {FAQ.map(([question, answer]) => (
              <details
                key={question}
                className="notch group border border-ink-800 bg-ink-900/40 p-4 open:bg-ink-900/70"
              >
                <summary className="cursor-pointer list-none font-display text-sm font-semibold text-paper marker:content-none">
                  <span className="flex items-center justify-between gap-3">
                    {question}
                    <span className="shrink-0 text-smoke-600 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-smoke-500">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
