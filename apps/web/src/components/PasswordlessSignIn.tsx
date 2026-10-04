import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { AuthProvidersDto } from "../api/types";
import { useAuth } from "../lib/auth-context";

/** Google Identity Services, loaded on demand (only when the server has a Google client id). */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

let gisScript: Promise<GoogleIdentity> | null = null;
function loadGoogleIdentity(): Promise<GoogleIdentity> {
  gisScript ??= new Promise((resolve, reject) => {
    const existing = (window as Window & { google?: GoogleIdentity }).google;
    if (existing?.accounts?.id) return resolve(existing);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const google = (window as Window & { google?: GoogleIdentity }).google;
      if (google?.accounts?.id) resolve(google);
      else reject(new Error("Google sign-in didn't load"));
    };
    script.onerror = () => {
      gisScript = null;
      reject(new Error("Google sign-in didn't load"));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

interface Props {
  /** In-app path the emailed link should land on (default: the profile). */
  redirect?: string;
  /** Called after a Google sign-in completes in place (email links complete on their own page). */
  onSignedIn?: () => void;
  /** Heading copy for the email form's button. */
  emailCta?: string;
}

const inputClass =
  "notch-sm w-full border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-paper outline-none focus:border-mint-500";

/**
 * Passwordless sign-in: "Continue with Google" (when the server has a Google client id) and a
 * one-time link by email. A guest who uses either keeps their runs — the server turns the guest
 * into the account, or merges it into an existing one (see AuthService on the API).
 */
export function PasswordlessSignIn({ redirect, onSignedIn, emailCta = "Email me a sign-in link" }: Props) {
  const { signInWithGoogle } = useAuth();
  const [providers, setProviders] = useState<AuthProvidersDto | null>(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  useEffect(() => {
    let cancelled = false;
    api
      .getAuthProviders()
      .then((p) => {
        if (!cancelled) setProviders(p);
      })
      .catch(() => {
        if (!cancelled) setProviders({ emailLink: true, google: false, googleClientId: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const clientId = providers?.googleClientId;
    if (!clientId || !googleButtonRef.current) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !googleButtonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            setError(null);
            setBusy(true);
            signInWithGoogle(credential)
              .then(() => onSignedInRef.current?.())
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Google sign-in failed"))
              .finally(() => setBusy(false));
          },
        });
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: googleButtonRef.current.offsetWidth || 320,
        });
      })
      .catch(() => {
        if (!cancelled) setProviders((p) => (p ? { ...p, google: false } : p));
      });
    return () => {
      cancelled = true;
    };
  }, [providers?.googleClientId, signInWithGoogle]);

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.requestMagicLink(email, redirect);
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the link");
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-2 text-center" role="status">
        <p className="text-2xl" aria-hidden>
          ✉️
        </p>
        <p className="font-semibold text-paper">Check your inbox</p>
        <p className="text-sm text-smoke-500">
          We sent a sign-in link to <span className="text-paper">{sentTo}</span>. It works once and expires in 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="text-xs text-smoke-500 underline-offset-2 hover:text-smoke-300 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {providers?.google && (
        <>
          <div ref={googleButtonRef} className="flex min-h-[44px] w-full justify-center" data-testid="google-button" />
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-smoke-600">
            <span className="h-px flex-1 bg-ink-800" />
            or
            <span className="h-px flex-1 bg-ink-800" />
          </div>
        </>
      )}
      <form onSubmit={handleEmail} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-widest text-smoke-600">Email</span>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="notch-sm w-full bg-mint-500 py-2 text-sm font-display font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-mint-400 disabled:opacity-50"
        >
          {busy ? "Sending…" : emailCta}
        </button>
      </form>
      {error && <p className="text-sm text-crimson-400">{error}</p>}
      <p className="text-center text-[11px] text-smoke-600">No password needed — we email you a one-time link.</p>
    </div>
  );
}
