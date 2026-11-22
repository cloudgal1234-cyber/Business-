/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: { sans: ['Heebo', 'Assistant', 'system-ui', 'Arial', 'sans-serif'] },
      colors: {
        investor: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 900: '#1e1b4b' },
        coach: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b' },
      },
      keyframes: { fadeIn: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } } },
      animation: { fadeIn: 'fadeIn .35s ease-out' },
    },
  },
  plugins: [],
};
