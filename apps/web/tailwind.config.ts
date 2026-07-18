import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#04140c",
          900: "#062615",
          800: "#0b3a20",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
