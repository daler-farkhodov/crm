import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
