/**
 * Share images (1080×1350, the portrait size every social app shows uncropped) drawn with the
 * Canvas 2D API — no extra dependency, and no DOM-screenshot library fighting our fonts and
 * gradients. The card is described by a plain model so each moment (season, January, Europe) only
 * decides *what* to say; this file decides how it looks.
 */

export interface ShareStat {
  label: string;
  value: string;
  color?: string;
}

export interface ShareCardModel {
  /** Small caps line at the top ("Season result", "January window"). */
  kicker: string;
  /** Big name line (the XI's name). */
  title: string;
  /** Context under the title ("🏴 Premier League · 4-3-3 · Normal"). */
  subtitle?: string;
  /** The hero result ("Champions", "5th", "+6 OVR"). */
  headline: string;
  headlineColor?: string;
  stats: ShareStat[];
  /** Up to ~6 short supporting lines (awards, the verdict, the deal). */
  lines: string[];
  /** Optional ribbon ("UNBEATEN"). */
  ribbon?: string;
  /** Accent for the frame and ribbon. */
  accent?: string;
}

export const SHARE_COLORS = {
  bg: "#0a0a0b",
  panel: "#131316",
  paper: "#f4f4f6",
  smoke: "#a6a6ad",
  mint: "#3ed98f",
  teal: "#4facc9",
  crimson: "#ef7176",
  amber: "#e6b559",
} as const;

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;
const SITE = "futbol · draft · simulate · go unbeaten";

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, weight: string, family: string): void {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px ${family}`;
    px -= 4;
  } while (ctx.measureText(text).width > maxWidth && px > 24);
}

/** Draws the card onto a SHARE_WIDTH × SHARE_HEIGHT context. Exported for tests with a fake context. */
export function drawShareCard(ctx: CanvasRenderingContext2D, card: ShareCardModel): void {
  const W = SHARE_WIDTH;
  const H = SHARE_HEIGHT;
  const accent = card.accent ?? SHARE_COLORS.mint;
  const display = "Oswald, 'Arial Narrow', sans-serif";
  const body = "'Work Sans', Arial, sans-serif";

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f2a1d");
  bg.addColorStop(0.45, SHARE_COLORS.bg);
  bg.addColorStop(1, SHARE_COLORS.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Signature stripe + frame.
  const stripe = ctx.createLinearGradient(0, 0, W, 0);
  ["#1fbf75", "#2f8fb0", "#9c4f7a", "#e5484d"].forEach((c, i) => stripe.addColorStop(i / 3, c));
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, W, 14);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 54, W - 80, H - 108);
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = SHARE_COLORS.smoke;
  ctx.font = `600 34px ${body}`;
  ctx.fillText(card.kicker.toUpperCase(), W / 2, 150);

  ctx.fillStyle = SHARE_COLORS.paper;
  fit(ctx, card.title.toUpperCase(), W - 180, 92, "700", display);
  ctx.fillText(card.title.toUpperCase(), W / 2, 260);

  if (card.subtitle) {
    ctx.fillStyle = SHARE_COLORS.smoke;
    ctx.font = `400 34px ${body}`;
    ctx.fillText(card.subtitle, W / 2, 320);
  }

  ctx.fillStyle = card.headlineColor ?? accent;
  fit(ctx, card.headline.toUpperCase(), W - 180, 170, "700", display);
  ctx.fillText(card.headline.toUpperCase(), W / 2, 500);

  // Stat tiles.
  const stats = card.stats.slice(0, 4);
  if (stats.length > 0) {
    const gap = 24;
    const tileW = (W - 160 - gap * (stats.length - 1)) / stats.length;
    stats.forEach((s, i) => {
      const x = 80 + i * (tileW + gap);
      ctx.fillStyle = SHARE_COLORS.panel;
      ctx.fillRect(x, 570, tileW, 170);
      ctx.fillStyle = s.color ?? SHARE_COLORS.paper;
      fit(ctx, s.value, tileW - 30, 84, "700", display);
      ctx.fillText(s.value, x + tileW / 2, 670);
      ctx.fillStyle = SHARE_COLORS.smoke;
      ctx.font = `600 26px ${body}`;
      ctx.fillText(s.label.toUpperCase(), x + tileW / 2, 715);
    });
  }

  ctx.fillStyle = SHARE_COLORS.paper;
  card.lines.slice(0, 6).forEach((line, i) => {
    fit(ctx, line, W - 200, 40, "400", body);
    ctx.fillText(line, W / 2, 830 + i * 68);
  });

  if (card.ribbon) {
    ctx.save();
    ctx.translate(W - 170, 140);
    ctx.rotate(Math.PI / 12);
    ctx.fillStyle = accent;
    ctx.fillRect(-150, -38, 300, 64);
    ctx.fillStyle = SHARE_COLORS.bg;
    ctx.font = `700 36px ${display}`;
    ctx.fillText(card.ribbon.toUpperCase(), 0, 10);
    ctx.restore();
  }

  ctx.fillStyle = SHARE_COLORS.smoke;
  ctx.font = `600 28px ${body}`;
  ctx.fillText(SITE.toUpperCase(), W / 2, H - 100);
}

/** Renders the card to a PNG blob, or null where canvas isn't available (old browsers, tests). */
export async function renderShareImage(card: ShareCardModel): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return null;
  }
  if (!ctx) return null;
  try {
    // Make sure the display fonts are in before drawing, or the card falls back to Arial.
    await document.fonts?.ready;
  } catch {
    // fonts API unavailable — draw with fallbacks
  }
  drawShareCard(ctx, card);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

const ORDINAL_SUFFIX = ["th", "st", "nd", "rd"];
export function ordinal(n: number): string {
  const v = n % 100;
  return `${n}${ORDINAL_SUFFIX[(v - 20) % 10] ?? ORDINAL_SUFFIX[v] ?? ORDINAL_SUFFIX[0]}`;
}
