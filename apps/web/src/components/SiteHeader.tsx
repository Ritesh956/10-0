import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

interface Props {
  onRequestSaveProgress?: (() => void) | undefined;
}

export function SiteHeader({ onRequestSaveProgress }: Props) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b-2 border-ink-800 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="notch-sm flex h-7 w-7 items-center justify-center border-2 border-gold-500 bg-ink-900 font-display text-xs font-bold text-gold-400">
            XI
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-paper">Futbol</span>
        </Link>

        {isAuthenticated ? (
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-smoke-500">
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
              className="notch-sm shrink-0 border-2 border-ink-700 px-3 py-1.5 text-smoke-500 transition hover:border-ink-600 hover:text-paper"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            to="/signin"
            className="notch-sm border-2 border-ink-700 px-3 py-1.5 text-sm font-medium text-paper transition hover:border-gold-500/60"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
