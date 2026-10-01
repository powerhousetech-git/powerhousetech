/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Campaign palette (per design guidelines)
        india: '#F97316',
        us: '#3B82F6',
        positive: '#22C55E',
        // Surface tokens backed by CSS variables so light/dark can swap.
        surface: {
          950: 'rgb(var(--s-950) / <alpha-value>)',
          900: 'rgb(var(--s-900) / <alpha-value>)',
          850: 'rgb(var(--s-850) / <alpha-value>)',
          800: 'rgb(var(--s-800) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
