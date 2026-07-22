import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { SaveProgressModal } from "./SaveProgressModal";
import { Button } from "./ui/Button";

/** The peak-moment guest-persistence prompt (38-0 §6g) — a softer, inline reinforcement on the
    results screen, distinct from both the hard squad-confirm GuestGateModal and SiteHeader's
    always-visible header button. Reuses the existing SaveProgressModal rather than duplicating its
    email/password form. Renders nothing for a signed-up (non-guest) user. */
export function GuestPersistPrompt() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!user?.isGuest) return null;

  return (
    <>
      <div className="notch space-y-2 border border-teal-500/30 bg-teal-500/5 p-4 text-center">
        <p className="text-sm font-semibold text-paper">Don&apos;t lose this season</p>
        <p className="text-xs text-smoke-400">
          You&apos;re playing as a guest — add an email and password to keep this run, your trophies, and your history
          forever.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowModal(true)}>
          Save my progress
        </Button>
      </div>
      {showModal && <SaveProgressModal onClose={() => setShowModal(false)} />}
    </>
  );
}
