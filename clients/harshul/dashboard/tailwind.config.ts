import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand: deep blue primary, teal accent, warm-white background.
        brand: {
          50: "#eef4fb",
          100: "#d6e4f0",
          500: "#2b5a8c",
          600: "#1e3a5f", // primary
          700: "#172c48",
          800: "#112238",
        },
        teal: {
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488", // accent
          700: "#0f766e",
        },
        canvas: {
          light: "#fafaf9",
          dark: "#0b1220",
        },
        surface: {
          light: "#ffffff",
          dark: "#111a2e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 4px 20px rgba(16,24,40,0.06)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
    },
  },
  plugins: [],
};
export default config;
