import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { Button } from "./ui/Button";

interface Props {
  onDone: () => void;
  onCancel: () => void;
  /** Session-expiry recovery (see CLAUDE.md's JWT-expiry gotcha): isAuthenticated only checks
      whether a token/user is present locally, never whether the server still honors it, so a
      24h-old token can sail past that check and only fail once an authenticated action actually
      hits the API. Callers that catch a 401 here (rather than the normal "never signed in" path)
      pass a reason so the copy reflects what actually happened, and a "Sign in instead" link is
      shown alongside the guest option — re-creating a guest would silently reattribute the run
      away from a real account, so a returning user needs a way back to their own login. */
  reason?: "not-signed-in" | "session-expired";
}

/** Guest-first per CLAUDE.md: only asked right when an authenticated action is needed. */
export function GuestGateModal({ onDone, onCancel, reason = "not-signed-in" }: Props) {
  const { playAsGuest } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await playAsGuest(displayName);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-6">
      <div className="notch w-full max-w-sm border-2 border-mint-500/30 bg-ink-900 p-6 shadow-2xl shadow-mint-500/5">
        <span className="notch-sm mb-3 flex h-9 w-9 items-center justify-center border-2 border-mint-500/50 bg-mint-500/10 text-base">
          &#9917;
        </span>
        {reason === "session-expired" ? (
          <>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">
              Your session expired
            </h2>
            <p className="mt-1 text-sm text-smoke-500">
              Nothing&apos;s lost — your picks are still right here. Sign back in to save this XI to your account, or
              continue as a new guest below.
            </p>
            <p className="mt-3 text-sm">
              <Link to="/signin" className="text-mint-400 underline hover:text-mint-300">
                Sign in instead &rarr;
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">One more thing</h2>
            <p className="mt-1 text-sm text-smoke-500">
              Pick a username so we know whose XI this is. No password needed.
            </p>
          </>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            autoFocus
            className="notch-sm w-full border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-mint-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. GoalMachine22"
            required
            minLength={2}
            maxLength={40}
          />

          {error && <p className="text-sm text-crimson-400">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? "Please wait..." : "Continue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
