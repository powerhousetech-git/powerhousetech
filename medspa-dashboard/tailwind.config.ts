import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#13131A",
        "surface-hover": "#1C1C28",
        border: "#2A2A3A",
        // PowerhouseTech brand indigo (site primary), not generic AI purple
        primary: "#424FD1",
        "primary-light": "#6B7AE8",
        "text-primary": "#F8F8FF",
        "text-secondary": "#9999AA",
        "text-muted": "#55556A",
        "accent-green": "#22C55E",
        "accent-red": "#EF4444",
        "accent-amber": "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(66,79,209,0.06), 0 4px 24px rgba(0,0,0,0.4)",
        glow: "0 0 0 1px rgba(66,79,209,0.28), 0 8px 32px rgba(66,79,209,0.18)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
