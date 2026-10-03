import { createHash, randomBytes } from "node:crypto";

/** Passwordless sign-in rules, kept free of Nest/Prisma so they're unit-testable. */

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
/** Links one address may request per TTL window — enough for "didn't arrive, send another". */
export const MAGIC_LINK_MAX_PER_WINDOW = 5;

export function newMagicToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this is stored, so the table can't be used to sign in if it ever leaks. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "jamie.vardy_9@x.com" → "Jamie Vardy 9", trimmed to the 2–40 characters a display name allows. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/\+.*$/, "")
    .split(/[._\-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  const name = words.join(" ").slice(0, 40).trim();
  return name.length >= 2 ? name : "Futbol Player";
}

export interface AccountCandidate {
  id: string;
  isGuest: boolean;
  email: string | null;
}

export type AccountDecision =
  | { action: "sign-in"; userId: string; mergeGuestId: string | null }
  | { action: "upgrade-guest"; userId: string }
  | { action: "create" };

/**
 * Who a verified identity (an email from a magic link, or a Google account) signs in as:
 *  - an existing account for that identity always wins — and a guest session that asked for it
 *    has its runs merged in, so playing as a guest on a new device before signing in loses nothing;
 *  - otherwise the current guest becomes the account (same row, history carries over);
 *  - otherwise a new account is created.
 */
export function decideAccount(existing: AccountCandidate | null, guest: AccountCandidate | null): AccountDecision {
  const usableGuest = guest && guest.isGuest && !guest.email ? guest : null;
  if (existing) {
    return { action: "sign-in", userId: existing.id, mergeGuestId: usableGuest && usableGuest.id !== existing.id ? usableGuest.id : null };
  }
  if (usableGuest) return { action: "upgrade-guest", userId: usableGuest.id };
  return { action: "create" };
}

export interface GoogleTokenInfo {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string | number;
  name?: string;
}

/** Checks the claims Google's tokeninfo endpoint returns for an ID token. Returns the identity, or
    a reason it's not acceptable (wrong app, unverified email, expired). */
export function checkGoogleClaims(
  info: GoogleTokenInfo,
  clientId: string,
  nowSeconds: number,
): { ok: true; sub: string; email: string; name: string | null } | { ok: false; reason: string } {
  if (info.aud !== clientId) return { ok: false, reason: "Token was issued for a different app" };
  if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
    return { ok: false, reason: "Token wasn't issued by Google" };
  }
  if (!info.sub || !info.email) return { ok: false, reason: "Token is missing the account id or email" };
  if (info.email_verified !== true && info.email_verified !== "true") return { ok: false, reason: "Google email isn't verified" };
  if (Number(info.exp ?? 0) <= nowSeconds) return { ok: false, reason: "Token has expired" };
  return { ok: true, sub: info.sub, email: normalizeEmail(info.email), name: info.name?.trim() || null };
}
