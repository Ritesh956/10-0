import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth-context";
import { Button } from "./ui/Button";

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

/** Guest-first per CLAUDE.md: only asked right when an authenticated action is needed. */
export function GuestGateModal({ onDone, onCancel }: Props) {
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
      <div className="notch w-full max-w-sm border-2 border-ink-700 bg-ink-900 p-6 shadow-2xl">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">One more thing</h2>
        <p className="mt-1 text-sm text-smoke-500">Pick a username so we know whose XI this is. No password needed.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            autoFocus
            className="notch-sm w-full border-2 border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-gold-500"
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
