import { describe, expect, it } from "vitest";
import { checkGoogleClaims, decideAccount, displayNameFromEmail, hashToken, newMagicToken } from "./passwordless.logic.js";

describe("decideAccount", () => {
  const guest = { id: "g", isGuest: true, email: null };
  const account = { id: "a", isGuest: false, email: "a@x.com" };

  it("signs into the existing account and merges the guest session that asked", () => {
    expect(decideAccount(account, guest)).toEqual({ action: "sign-in", userId: "a", mergeGuestId: "g" });
  });

  it("signs in without a merge when there's no guest", () => {
    expect(decideAccount(account, null)).toEqual({ action: "sign-in", userId: "a", mergeGuestId: null });
  });

  it("upgrades the guest in place when the identity is new", () => {
    expect(decideAccount(null, guest)).toEqual({ action: "upgrade-guest", userId: "g" });
  });

  it("never treats a full account as a guest to upgrade or merge", () => {
    expect(decideAccount(null, account)).toEqual({ action: "create" });
    expect(decideAccount(account, { id: "b", isGuest: false, email: "b@x.com" })).toMatchObject({ mergeGuestId: null });
  });

  it("creates an account when there's nothing to reuse", () => {
    expect(decideAccount(null, null)).toEqual({ action: "create" });
  });
});

describe("displayNameFromEmail", () => {
  it.each([
    ["jamie.vardy_9@leicester.com", "Jamie Vardy 9"],
    ["kdb+futbol@city.com", "Kdb"],
    ["x@y.com", "Futbol Player"],
  ])("%s → %s", (email, name) => {
    expect(displayNameFromEmail(email)).toBe(name);
  });
});

describe("magic tokens", () => {
  it("are random and only ever stored hashed", () => {
    const a = newMagicToken();
    expect(a).not.toBe(newMagicToken());
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });
});

describe("checkGoogleClaims", () => {
  const good = { aud: "client", iss: "https://accounts.google.com", sub: "123", email: "Mo@Gmail.com", email_verified: "true", exp: "2000", name: "Mo" };

  it("accepts a valid token and normalises the email", () => {
    expect(checkGoogleClaims(good, "client", 1000)).toEqual({ ok: true, sub: "123", email: "mo@gmail.com", name: "Mo" });
  });

  it.each([
    [{ aud: "other" }, /different app/],
    [{ iss: "evil.com" }, /issued by Google/],
    [{ email_verified: "false" }, /verified/],
    [{ exp: "999" }, /expired/],
    [{ sub: undefined }, /missing/],
  ])("rejects %o", (patch, reason) => {
    const result = checkGoogleClaims({ ...good, ...patch }, "client", 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });
});
