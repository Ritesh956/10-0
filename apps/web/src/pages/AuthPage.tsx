import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

export function AuthPage() {
  const navigate = useNavigate();
  const { playAsGuest, login } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePlay(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await playAsGuest(displayName);
      navigate("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 bg-grass-lines px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="notch-sm mx-auto flex h-12 w-12 items-center justify-center border-2 border-gold-500 bg-ink-900 font-display text-lg font-bold text-gold-400">
            XI
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold uppercase tracking-widest text-paper">Futbol</h1>
          <p className="mt-2 text-sm text-smoke-500">Draw a squad. Simulate a season. Chase the unbeaten record.</p>
        </div>

        <div className="notch border-2 border-ink-700 bg-ink-900/70 p-6 shadow-xl">
          {!showSignIn ? (
            <>
              <form onSubmit={handlePlay} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-smoke-600">
                    Pick a username
                  </label>
                  <input
                    className="notch-sm w-full border-2 border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-gold-500"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. GoalMachine22"
                    required
                    minLength={2}
                    maxLength={40}
                  />
                </div>

                {error && <p className="text-sm text-crimson-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="notch-sm w-full bg-gold-500 py-2 text-sm font-display font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-gold-400 disabled:opacity-50"
                >
                  {busy ? "Please wait..." : "Play now"}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-smoke-600">
                No email or password needed to play. You can save your progress later.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowSignIn(true);
                  setError(null);
                }}
                className="mt-3 w-full text-center text-xs text-smoke-500 underline-offset-2 hover:text-smoke-300 hover:underline"
              >
                Already saved your progress? Sign in
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-smoke-600">
                    Email
                  </label>
                  <input
                    type="email"
                    className="notch-sm w-full border-2 border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-gold-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-smoke-600">
                    Password
                  </label>
                  <input
                    type="password"
                    className="notch-sm w-full border-2 border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-gold-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                {error && <p className="text-sm text-crimson-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="notch-sm w-full bg-gold-500 py-2 text-sm font-display font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-gold-400 disabled:opacity-50"
                >
                  {busy ? "Please wait..." : "Sign in"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setShowSignIn(false);
                  setError(null);
                }}
                className="mt-4 w-full text-center text-xs text-smoke-500 underline-offset-2 hover:text-smoke-300 hover:underline"
              >
                Back to play now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
