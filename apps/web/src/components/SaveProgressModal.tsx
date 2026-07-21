import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth-context";

interface Props {
  onClose: () => void;
}

export function SaveProgressModal({ onClose }: Props) {
  const { upgradeAccount } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await upgradeAccount(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-6">
      <div className="notch w-full max-w-sm border-2 border-teal-500/30 bg-ink-900 p-6 shadow-2xl shadow-teal-500/5">
        <span className="notch-sm mb-3 flex h-9 w-9 items-center justify-center border-2 border-teal-500/50 bg-teal-500/10 text-base">
          &#128190;
        </span>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">Save your progress</h2>
        <p className="mt-1 text-sm text-smoke-500">
          Add an email and password so your worlds and history stick around across devices.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-smoke-600">Email</label>
            <input
              type="email"
              className="notch-sm w-full border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-mint-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-smoke-600">Password</label>
            <input
              type="password"
              className="notch-sm w-full border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-mint-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && <p className="text-sm text-crimson-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="notch-sm flex-1 border border-ink-800 py-2 text-sm text-smoke-400 hover:border-ink-600"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={busy}
              className="notch-sm flex-1 bg-mint-500 py-2 text-sm font-display font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-mint-400 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save progress"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
