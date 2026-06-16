/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // C1.2 设计规范：基础色板
        atlas: {
          bg: '#0f1115',
          surface: '#1a1d24',
          border: '#2a2e38',
          primary: '#e8b04b',
          accent: '#7aa2f7',
          muted: '#8a8f99',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
