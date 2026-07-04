import type { Config } from "tailwindcss";

/**
 * Tailwind only emits CSS for class names found under `content`. If the UI suddenly
 * looks unstyled (plain HTML), the usual cause is an overly narrow `content` glob or
 * new folders outside these paths — fix the globs and run `npm run verify:tailwind`.
 */
export default {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mjs,cjs,mdx}",
    "./src/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          orange: "#f97316",
          "orange-soft": "#fff7ed",
          blue: "#2563eb",
          "blue-soft": "#eff6ff",
        },
        line: "#e2e8f0",
      },
    },
  },
  plugins: [],
} satisfies Config;
