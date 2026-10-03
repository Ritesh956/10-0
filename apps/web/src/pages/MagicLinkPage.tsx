import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

/** Only in-app paths are followed after sign-in — never another site. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
}

/** "/auth/magic?token=…" — where an emailed sign-in link lands. Completes the sign-in once and moves on. */
export function MagicLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMagicLink } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // A link is single-use, so React StrictMode's double-run of effects (dev) must not spend it twice.
  const started = useRef(false);

  const token = params.get("token");
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyMagicLink(token)
      .then(() => navigate(next, { replace: true }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "This sign-in link didn't work"));
  }, [token, next, navigate, verifyMagicLink]);

  return (
    <div className="mx-auto max-w-sm space-y-3 px-6 py-20 text-center">
      {!token || error ? (
        <>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">Link didn&apos;t work</h1>
          <p className="text-sm text-smoke-500">{error ?? "This link is missing its sign-in code."}</p>
          <Link to="/signin" className="inline-block text-sm font-semibold text-mint-400 hover:text-mint-300">
            Get a new link &rarr;
          </Link>
        </>
      ) : (
        <p className="text-sm text-smoke-500">Signing you in…</p>
      )}
    </div>
  );
}
