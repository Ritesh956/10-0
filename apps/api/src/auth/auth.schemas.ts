import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(40),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

/** No email/password required — play immediately, save history only if you later upgrade. */
export const guestSchema = z.object({
  displayName: z.string().min(2).max(40),
});
export type GuestDto = z.infer<typeof guestSchema>;

/** Attaches email/password to the current (guest) account so its history persists. */
export const upgradeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type UpgradeDto = z.infer<typeof upgradeSchema>;

/** Passwordless: ask for a one-time sign-in link. `redirect` is an in-app path to land on afterwards. */
export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
  redirect: z.string().max(200).optional(),
});
export type MagicLinkRequestDto = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkVerifySchema = z.object({ token: z.string().min(20).max(200) });
export type MagicLinkVerifyDto = z.infer<typeof magicLinkVerifySchema>;

/** The ID token ("credential") Google Identity Services hands the web app. */
export const googleSignInSchema = z.object({ credential: z.string().min(20) });
export type GoogleSignInDto = z.infer<typeof googleSignInSchema>;
