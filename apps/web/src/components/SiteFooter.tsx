import { Link } from "react-router-dom";
import { useT } from "../lib/i18n/context";
import type { MessageKey } from "../lib/i18n";

const NAV_LINKS: Array<{ label: MessageKey; to: string }> = [
  { label: "footer.home", to: "/" },
  { label: "footer.play", to: "/setup" },
  { label: "nav.daily", to: "/daily" },
  { label: "nav.oneClub", to: "/clubs" },
  { label: "nav.nations", to: "/nations" },
  { label: "footer.multiplayer", to: "/multiplayer" },
  { label: "nav.events", to: "/events" },
  { label: "nav.leaderboard", to: "/leaderboard" },
  { label: "nav.profile", to: "/profile" },
  { label: "footer.howItWorks", to: "/how-it-works" },
  { label: "footer.howToPlay", to: "/how-to-play" },
  { label: "footer.bestXi", to: "/best-xi" },
  { label: "footer.story", to: "/story" },
];

/** Where "Feedback & bugs" points. Override with VITE_FEEDBACK_URL (e.g. a mailto: or a form). */
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || "https://github.com/Ritesh956/10-0/issues/new";

export function SiteFooter() {
  const { t } = useT();
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
              {t(link.label)}
            </Link>
          );
        })}
      </nav>
      <p className="mt-5">
        <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="text-smoke-400 underline-offset-2 hover:text-paper hover:underline">
          {t("footer.feedback")}
        </a>
      </p>
      <p className="mt-4 text-xs text-ink-600">&copy; {new Date().getFullYear()} Futbol. All rights reserved.</p>
      <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed text-ink-600">
        Futbol is an independent fan-made football draft and season simulator. It is not affiliated with,
        endorsed by, sponsored by, or licensed by any club, competition, league, player, manager, or governing body.
        Some club, player, and manager names reflect real people and real historical rosters (top-5 European
        leagues, 2012/13–2025/26), included for factual reference; all overall ratings, attributes, tactical profiles,
        and match outcomes are calculated independently by Futbol and are not sourced from, affiliated with, or
        endorsed by any official rating system. Remaining content is fictional.
      </p>
    </footer>
  );
}
