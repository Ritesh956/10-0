import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** Neutral near-black chrome — the app shell, not the pitch. */
        ink: {
          950: "#0a0a0b",
          900: "#131316",
          850: "#19191d",
          800: "#202024",
          700: "#2d2d33",
          600: "#43434b",
        },
        /** Neutral cool-gray text scale. */
        smoke: {
          600: "#8b8b93",
          500: "#a6a6ad",
          400: "#c2c2c8",
        },
        /** Neutral off-white for headings. */
        paper: "#f4f4f6",
        /** Primary accent: fresh pitch mint. Actions, selection, primary CTAs. */
        mint: {
          500: "#1fbf75",
          400: "#3ed98f",
          300: "#7de8b6",
        },
        /** Secondary accent: informational / cool contrast. */
        teal: {
          500: "#2f8fb0",
          400: "#4facc9",
          300: "#7ec8dd",
        },
        /** Tertiary accent: social / blind-mode contexts. */
        plum: {
          500: "#9c4f7a",
          400: "#b8709a",
          300: "#d19fbb",
        },
        /** Danger / loss. */
        crimson: {
          500: "#e5484d",
          400: "#ef7176",
          300: "#f5a3a6",
        },
        /** Celebration / trophy accent — used sparingly (Golden Boot, medal moments), not the
            app's primary color anymore. */
        amber: {
          500: "#d69a34",
          400: "#e6b559",
          300: "#f0cd8a",
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
          "radial-gradient(circle at 50% 0%, rgba(31,191,117,0.07), transparent 55%), linear-gradient(180deg, rgba(10,10,11,0.4), rgba(10,10,11,0.9))",
      },
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.92) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "mint-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.25s ease-out",
        "mint-pulse": "mint-pulse 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
