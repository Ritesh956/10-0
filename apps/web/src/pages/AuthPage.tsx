import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth-context";

export function AuthPage() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-pitch-950 to-slate-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-emerald-400">FUTBOL</h1>
          <p className="mt-2 text-sm text-slate-400">Draft a squad. Simulate a season. Chase the unbeaten record.</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          {!showSignIn ? (
            <>
              <form onSubmit={handlePlay} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Pick a username
                  </label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. GoalMachine22"
                    required
                    minLength={2}
                    maxLength={40}
                  />
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? "Please wait..." : "Play now"}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-slate-500">
                No email or password needed to play. You can save your progress later.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowSignIn(true);
                  setError(null);
                }}
                className="mt-3 w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              >
                Already saved your progress? Sign in
              </button>
            </>
          ) : (
            <>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
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
                className="mt-4 w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
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
