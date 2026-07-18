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
