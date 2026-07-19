import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** Neutral warm-charcoal chrome — the app shell, not the pitch. */
        ink: {
          950: "#0a0908",
          900: "#151310",
          850: "#1b1814",
          800: "#211d17",
          700: "#332c23",
          600: "#4a4033",
        },
        /** Muted warm-gray text scale. */
        smoke: {
          600: "#8a8074",
          500: "#a89d8e",
          400: "#c4bbab",
        },
        /** Warm off-white for headings — never pure white. */
        paper: "#f3ede0",
        /** Primary accent: trophy gold. Actions, selection, celebration. */
        gold: {
          500: "#d69a34",
          400: "#e6b559",
          300: "#f0cd8a",
        },
        /** Secondary accent: informational. */
        teal: {
          500: "#3d8f82",
          400: "#5aada0",
          300: "#82c4b8",
        },
        /** Tertiary accent: social / blind-mode contexts. */
        plum: {
          500: "#9c4f7a",
          400: "#b8709a",
          300: "#d19fbb",
        },
        /** Danger / loss. */
        crimson: {
          500: "#b3452f",
          400: "#c8624a",
          300: "#dd8b78",
        },
        /** The literal grass — only ever used for the pitch graphic itself. */
        grass: {
          950: "#04140c",
          900: "#062615",
          800: "#0b3a20",
          700: "#0f4a29",
          600: "#166534",
        },
      },
      fontFamily: {
        display: ["'Oswald'", "system-ui", "sans-serif"],
        sans: ["'Work Sans'", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grass-lines":
          "radial-gradient(circle at 50% 0%, rgba(214,154,52,0.06), transparent 55%), linear-gradient(180deg, rgba(10,9,8,0.4), rgba(10,9,8,0.9))",
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.92) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "reel-cycle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6%)" },
        },
        /* Duplicating the reel list exactly 2x and animating to -50% (of the animated
           element's OWN height, per the CSS transform spec) always lands exactly one
           full original-list-height later, so the loop is seamless at any list length. */
        "reel-scroll": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        "gold-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.25s ease-out",
        "reel-cycle": "reel-cycle 0.12s linear infinite",
        "reel-scroll": "reel-scroll 0.6s linear infinite",
        "gold-pulse": "gold-pulse 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
