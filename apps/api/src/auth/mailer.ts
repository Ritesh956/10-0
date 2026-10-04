import { Injectable, Logger } from "@nestjs/common";

/**
 * Sends the sign-in email. With RESEND_API_KEY and MAIL_FROM set it goes through Resend's HTTP API
 * (no SDK dependency); without them — local dev — the link is written to the API log instead, so
 * the whole flow works before any email provider is configured.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger("Mailer");

  async sendMagicLink(to: string, link: string): Promise<void> {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["MAIL_FROM"];
    if (!apiKey || !from) {
      this.logger.log(`[dev] Sign-in link for ${to}: ${link}`);
      return;
    }
    const text = `Tap to sign in to Futbol:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`;
    const html = `<p>Tap to sign in to Futbol:</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1fbf75;color:#0a0f0d;font-weight:700;text-decoration:none;border-radius:6px">Sign in</a></p><p style="color:#666">The link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: "Your Futbol sign-in link", text, html }),
    });
    if (!res.ok) {
      this.logger.error(`Resend rejected the email (${res.status}): ${await res.text().catch(() => "")}`);
      throw new Error("Couldn't send the email");
    }
  }
}
