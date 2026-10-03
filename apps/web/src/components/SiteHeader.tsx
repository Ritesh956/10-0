import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

interface Props {
  onRequestSaveProgress?: (() => void) | undefined;
}

const NAV_LINKS: { to: string; label: string }[] = [
  { to: "/daily", label: "Daily" },
  { to: "/clubs", label: "One-Club XI" },
  { to: "/multiplayer", label: "Play with mates" },
  { to: "/leaderboard", label: "Leaderboard" },
];

const linkClass = ({ isActive }: { isActive: boolean }) => `transition hover:text-paper ${isActive ? "text-paper" : ""}`;

/** One compact row on every screen size (it used to wrap into three rows — ~30% of a phone screen).
    From `md` up the mode links sit inline; below that they live in a menu sheet behind a single
    button, next to a "Play" shortcut that's always visible. */
export function SiteHeader({ onRequestSaveProgress }: Props) {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
      {/* Thin four-color signature stripe tying the header to the accent tokens (mint, teal, plum,
          crimson). A true 4-stop gradient needs an arbitrary value — Tailwind's "via" takes one stop. */}
      <div className="h-[3px] bg-[linear-gradient(to_right,#1fbf75,#2f8fb0,#9c4f7a,#e5484d)]" />
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="notch-sm flex h-7 w-7 items-center justify-center border-2 border-mint-500 bg-ink-900 font-display text-xs font-bold text-mint-400 shadow-[0_0_10px_-2px_rgba(31,191,117,0.6)]">
            XI
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-paper">Futbol</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-5 text-sm text-smoke-400 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <NavLink to="/history" className={linkClass}>
              History
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="hidden items-center gap-3 text-sm text-smoke-400 md:flex">
            {isAuthenticated ? (
              <>
                {user?.isGuest && onRequestSaveProgress && (
                  <button
                    onClick={onRequestSaveProgress}
                    className="notch-sm border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400 transition hover:bg-teal-500/20"
                  >
                    Save progress
                  </button>
                )}
                <span className="max-w-[8rem] truncate">{user?.displayName}</span>
                <button onClick={logout} className="transition hover:text-paper">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/signin" className="transition hover:text-paper">
                Sign in
              </Link>
            )}
          </div>

          <Link
            to="/setup"
            className="notch-sm bg-mint-500 px-3.5 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-mint-400"
          >
            Play
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="notch-sm flex h-8 w-8 items-center justify-center border border-ink-800 text-paper md:hidden"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {menuOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="site-menu" className="border-t border-ink-800 bg-ink-950 px-4 pb-4 pt-2 md:hidden">
          <ul className="space-y-1 text-base text-smoke-300">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={({ isActive }) => `block py-2 ${isActive ? "text-paper" : ""}`}>
                  {l.label}
                </NavLink>
              </li>
            ))}
            <li>
              <NavLink to="/nations" className="block py-2">
                Nations
              </NavLink>
            </li>
            {isAuthenticated && (
              <li>
                <NavLink to="/history" className="block py-2">
                  History
                </NavLink>
              </li>
            )}
          </ul>
          <div className="mt-3 flex items-center gap-3 border-t border-ink-800 pt-3 text-sm text-smoke-400">
            {isAuthenticated ? (
              <>
                <span className="min-w-0 flex-1 truncate">{user?.displayName}</span>
                {user?.isGuest && onRequestSaveProgress && (
                  <button onClick={onRequestSaveProgress} className="font-semibold text-teal-400">
                    Save progress
                  </button>
                )}
                <button onClick={logout} className="hover:text-paper">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/signin" className="hover:text-paper">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
