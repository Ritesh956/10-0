import { Link } from "react-router-dom";

const NAV_LINKS: Array<{ label: string; to: string }> = [
  { label: "Home", to: "/" },
  { label: "Play", to: "/setup" },
  { label: "Multiplayer", to: "/multiplayer" },
  { label: "How It Works", to: "/how-it-works" },
  { label: "How to Play", to: "/how-to-play" },
  { label: "Best XI", to: "/best-xi" },
  { label: "Our Story", to: "/story" },
];

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink-800 px-6 py-10 text-center text-sm text-smoke-500">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-display uppercase tracking-wide">
        {NAV_LINKS.map((link, i) => {
          const hoverColor = [
            "hover:text-mint-400",
            "hover:text-teal-400",
            "hover:text-plum-400",
            "hover:text-crimson-400",
          ][i % 4];
          return (
            <Link key={link.to} to={link.to} className={`transition-colors ${hoverColor}`}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-6 text-xs text-ink-600">&copy; {new Date().getFullYear()} Futbol. All rights reserved.</p>
      <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed text-ink-600">
        Futbol is an independent fan-made football draft and season simulator. It is not affiliated with,
        endorsed by, sponsored by, or licensed by any club, competition, league, player, manager, or governing body.
        Some club, player, and manager names reflect real people and real historical rosters (top-5 European
        leagues, 2012–2024), included for factual reference; all overall ratings, attributes, tactical profiles,
        and match outcomes are calculated independently by Futbol and are not sourced from, affiliated with, or
        endorsed by any official rating system. Remaining content is fictional.
      </p>
    </footer>
  );
}
