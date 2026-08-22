/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        // Engineering tables read column-wise: a tabular, fixed-width face keeps
        // the digits aligned so magnitudes are comparable at a glance.
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        // The app is a wide engineering workspace: 7xl (1280px) minus a 288px
        // sidebar left under 1000px for tables of 7+ numeric columns.
        app: '1680px',
      },
      keyframes: {
        // Replaces the `animate-in fade-in` classes the code used, which come
        // from the `tailwindcss-animate` plugin that is NOT installed here —
        // they were emitting no CSS at all.
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
      },
    },
  },
  plugins: [],
}
