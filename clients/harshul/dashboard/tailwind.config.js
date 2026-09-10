/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, earthy tiles / home-improvement palette.
        sand: {
          50: "#FBF7F2",
          100: "#F5EDE3",
          200: "#EBDDCB",
          300: "#DEC7AC",
        },
        clay: {
          50: "#FBF0EA",
          100: "#F4D9C9",
          400: "#D97846",
          500: "#C2410C", // terracotta primary
          600: "#A5370B",
          700: "#7C2D0C",
        },
        amber: {
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
        },
        ink: {
          900: "#1C1917",
          700: "#44403C",
          500: "#78716C",
          400: "#A8A29E",
        },
        line: "#E7DED2",
        success: "#16A34A",
        "success-bg": "#DCFCE7",
        danger: "#DC2626",
        "danger-bg": "#FEE2E2",
        warn: "#D97706",
        "warn-bg": "#FEF3C7",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,25,23,0.04), 0 4px 16px rgba(124,45,12,0.06)",
        pop: "0 8px 30px rgba(28,25,23,0.16)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
    },
  },
  plugins: [],
};
