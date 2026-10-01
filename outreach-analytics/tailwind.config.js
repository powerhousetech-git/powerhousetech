/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand / campaign palette (per design guidelines)
        india: '#F97316', // orange
        us: '#3B82F6', // blue
        positive: '#22C55E', // green / interested
        // Dark navy / slate surface tokens
        surface: {
          950: '#0b1120',
          900: '#0f172a',
          850: '#131c31',
          800: '#1e293b',
          700: '#334155',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
