import { Link, useNavigate } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
import { Button } from "../components/ui/Button";

interface OtherModeCard {
  title: string;
  description: string;
  icon: string;
}

const OTHER_MODES: OtherModeCard[] = [
  {
    title: "One-Club Legacy",
    description: "Draft one club's greatest XI, pulled from across its own history.",
    icon: "\u{1F3DF}️",
  },
  {
    title: "Daily Card",
    description: "One fresh matchup a day. Same draw for everyone, one attempt.",
    icon: "\u{1F5D3}️",
  },
];

const HOW_IT_WORKS: Array<[string, string]> = [
  ["Set the rules", "Pick a league (or every league), a formation, and how forgiving the draw should be."],
  ["Draw a name", "Land on a random club and season, then pick a player out of that exact squad."],
  ["Fill the shirt", "Repeat until all 11 spots are taken — redraw if a name doesn't work out."],
  ["Kick off", "Simulate a season and see how close your XI gets to going unbeaten."],
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">Bring a mate</p>
          <Link
            to="/multiplayer"
            className="notch flex items-center justify-between border border-ink-800 bg-ink-900/50 p-5 transition hover:border-plum-500/60"
          >
            <span className="flex items-center gap-4">
              <span className="notch-sm flex h-10 w-10 items-center justify-center border border-plum-500/40 bg-plum-500/10 text-xl">
                &#9917;
              </span>
              <span>
                <span className="block font-display font-bold uppercase tracking-wide text-paper">Head to Head</span>
                <span className="block text-sm text-smoke-500">Two players, one device, same rules — draw, draft, and settle it on the pitch.</span>
              </span>
            </span>
            <span className="text-smoke-600">&rarr;</span>
          </Link>
        </section>

        <section className="mt-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">Other modes</p>
          <div className="space-y-3">
            {OTHER_MODES.map((card, i) => {
              const tint = [
                { border: "border-teal-500/20", bg: "bg-teal-500/5" },
                { border: "border-crimson-500/20", bg: "bg-crimson-500/5" },
              ][i % 2]!;
              return (
              <div
                key={card.title}
                className={`notch flex items-center justify-between border-2 ${tint.border} bg-ink-900/30 p-5 opacity-70`}
              >
                <span className="flex items-center gap-4">
                  <span className={`notch-sm flex h-10 w-10 items-center justify-center border ${tint.border} ${tint.bg} text-xl`}>
                    {card.icon}
                  </span>
                  <span>
                    <span className="block font-display font-bold uppercase tracking-wide text-paper">{card.title}</span>
                    <span className="block text-sm text-smoke-500">{card.description}</span>
                  </span>
                </span>
                <span className="notch-sm border border-ink-700 bg-ink-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-smoke-500">
                  Not yet
                </span>
              </div>
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
      </div>
      <SiteFooter />
    </>
  );
}
