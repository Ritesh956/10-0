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
            <span className="notch-sm inline-flex items-center gap-2 border-2 border-ink-700 bg-ink-900 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-500">
              Fan project &middot; not affiliated with any league
            </span>

            <h1 className="mt-6 font-display text-5xl font-bold uppercase leading-[1.05] tracking-tight text-paper sm:text-6xl">
              Draft a legend
              <br />
              from any league,
              <br />
              <span className="text-gold-400">any era.</span>
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

          <div className="notch border-2 border-ink-700 bg-ink-900/70 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-smoke-600">Archive on file</p>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Leagues</dt>
                <dd className="font-display text-3xl font-bold text-gold-400">6</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Countries</dt>
                <dd className="font-display text-3xl font-bold text-gold-400">4</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Clubs</dt>
                <dd className="font-display text-3xl font-bold text-paper">36</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-smoke-600">Seasons span</dt>
                <dd className="font-display text-xl font-bold text-paper">1992–2025</dd>
              </div>
            </dl>
          </div>
        </div>

        <section className="mt-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">Bring a mate</p>
          <Link
            to="/multiplayer"
            className="notch flex items-center justify-between border-2 border-ink-700 bg-ink-900/50 p-5 transition hover:border-plum-500/60"
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
            {OTHER_MODES.map((card) => (
              <div
                key={card.title}
                className="notch flex items-center justify-between border-2 border-ink-800 bg-ink-900/30 p-5 opacity-70"
              >
                <span className="flex items-center gap-4">
                  <span className="notch-sm flex h-10 w-10 items-center justify-center border border-ink-700 bg-ink-800 text-xl">
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
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mt-20 scroll-mt-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke-600">How a run works</p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {HOW_IT_WORKS.map(([title, body], i) => (
              <li key={title} className="notch flex gap-4 border-2 border-ink-700 bg-ink-900/40 p-4">
                <span className="notch-sm flex h-8 w-8 shrink-0 items-center justify-center border border-gold-500/40 bg-gold-500/10 font-display font-bold text-gold-400">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-display font-semibold uppercase tracking-wide text-paper">{title}</span>
                  <span className="block text-sm text-smoke-500">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
