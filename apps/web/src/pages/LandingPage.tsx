import { Link, useNavigate } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
import { Button } from "../components/ui/Button";

interface ModeCard {
  title: string;
  description: string;
  icon: string;
  to: string;
}

/** Phase 10: every shipped mode as a real, clickable card — this used to render only "One-Club
    Legacy"/"Daily Card" as opacity-70 "Not yet" stubs (stale placeholder copy left over from
    before Phases 7/8 actually shipped those modes), and never mentioned Multiplayer or Nations at
    all here. All five modes now link straight to where they actually live. */
const MODE_CARDS: ModeCard[] = [
  {
    title: "Classic Draft",
    description: "Spin a random club-season from any top-5 league and build your fantasy XI, shirt by shirt.",
    icon: "\u{1F3C6}",
    to: "/setup",
  },
  {
    title: "Head to Head",
    description: "Two players, one device, same rules — draw, draft, and settle it on the pitch.",
    icon: "\u{26BD}",
    to: "/multiplayer",
  },
  {
    title: "One-Club XI",
    description: "Draft one real club's greatest XI, pulled from across its own history.",
    icon: "\u{1F3DF}\u{FE0F}",
    to: "/clubs",
  },
  {
    title: "Daily Challenge",
    description: "One fresh, themed puzzle a day. Same draw for everyone, five attempts.",
    icon: "\u{1F5D3}\u{FE0F}",
    to: "/daily",
  },
  {
    title: "Nations Trophy",
    description: "Draft a nation's XI, pulled from every player of that nationality across the top-5.",
    icon: "\u{1F30D}",
    to: "/nations",
  },
];

const HOW_IT_WORKS: Array<[string, string]> = [
  ["Set the rules", "Pick a league (or every league), a formation, and how forgiving the draw should be."],
  ["Draw a name", "Land on a random club and season, then pick a player out of that exact squad."],
  ["Fill the shirt", "Repeat until all 11 spots are taken — redraw if a name doesn't work out."],
  ["Kick off", "Simulate a season and see how close your XI gets to going unbeaten."],
];

const FAQ: Array<[string, string]> = [
  [
    "Is this affiliated with any real league or club?",
    "No. Futbol is an independent fan project. Club, player, and manager names reflect real people and real historical rosters (top-5 European leagues, 2012–2024), included for factual reference — but all ratings, tactics, and match outcomes are our own calculation, not sourced from or endorsed by any official body.",
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

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[3fr_2fr] md:items-center">
          <div>
            <span className="notch-sm inline-flex items-center gap-2 border-2 border-mint-500/30 bg-mint-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
              Fan project &middot; not affiliated with any league
            </span>

            <h1 className="mt-6 font-display text-5xl font-bold uppercase leading-[1.05] tracking-tight text-paper sm:text-6xl">
              Draft a legend
              <br />
              from any league,
              <br />
              <span className="bg-gradient-to-r from-mint-300 via-mint-400 to-crimson-400 bg-clip-text text-transparent">
                any era.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-sm leading-relaxed text-smoke-500">
              Set your rules, draw random clubs and seasons out of the archive, and build a starting XI one shirt
              at a time. Then simulate a season and see how far an unbeaten run gets you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/setup")}>
                Start a draft &rarr;
              </Button>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" fullWidth>
                  See how a run works
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
                <dd className="font-display text-3xl font-bold text-mint-400">12</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Countries</dt>
                <dd className="font-display text-3xl font-bold text-teal-400">9</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Clubs</dt>
                <dd className="font-display text-3xl font-bold text-plum-400">200+</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Seasons span</dt>
                <dd className="font-display text-xl font-bold text-crimson-400">1992–2025</dd>
              </div>
            </dl>
          </div>
        </div>

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
                      <span className="block font-display font-bold uppercase tracking-wide text-paper">{card.title}</span>
                      <span className="block text-sm text-smoke-500">{card.description}</span>
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
