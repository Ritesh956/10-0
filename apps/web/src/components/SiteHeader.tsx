import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

interface Props {
  onRequestSaveProgress?: (() => void) | undefined;
}

export function SiteHeader({ onRequestSaveProgress }: Props) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b-2 border-ink-800 bg-ink-950/90 backdrop-blur">
      {/* Thin four-color signature stripe — team-colors flourish that ties every page's header
          back to the four accent tokens (mint, teal, plum, crimson) used across the whole app.
          Tailwind's "via" utility only supports a single color stop, so a true 4-stop gradient
          needs an explicit arbitrary value instead of stacking multiple via-color classes. */}
      <div className="h-[3px] bg-[linear-gradient(to_right,#1fbf75,#2f8fb0,#9c4f7a,#e5484d)]" />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="notch-sm flex h-7 w-7 items-center justify-center border-2 border-mint-500 bg-ink-900 font-display text-xs font-bold text-mint-400 shadow-[0_0_10px_-2px_rgba(31,191,117,0.6)]">
            XI
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-paper">Futbol</span>
        </Link>

        {/* Public — no ownership/auth gate, unlike History, so both sit outside the isAuthenticated branch below. */}
        <div className="flex shrink-0 items-center gap-4 text-sm text-smoke-500">
          <Link to="/daily" className="transition hover:text-paper">
            Daily Challenge
          </Link>
          <Link to="/clubs" className="transition hover:text-paper">
            One-Club XI
          </Link>
          <Link to="/leaderboard" className="transition hover:text-paper">
            Leaderboard
          </Link>
        </div>

        {isAuthenticated ? (
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-smoke-500">
            <Link to="/history" className="shrink-0 transition hover:text-paper">
              History
            </Link>
            {user?.isGuest && onRequestSaveProgress && (
              <button
                onClick={onRequestSaveProgress}
                className="notch-sm shrink-0 border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400 transition hover:bg-teal-500/20"
              >
                Save your progress
              </button>
            )}
            <span className="max-w-[10rem] truncate">{user?.displayName}</span>
            <button
              onClick={logout}
              className="notch-sm shrink-0 border border-ink-800 px-3 py-1.5 text-smoke-500 transition hover:border-ink-600 hover:text-paper"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            to="/signin"
            className="notch-sm border border-ink-800 px-3 py-1.5 text-sm font-medium text-paper transition hover:border-mint-500/60"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
