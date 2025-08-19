/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./db.html", 
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        'deputy': '#3b82f6',
        'supplier': 'rgb(196, 82, 17)',
        'duckdb': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24', 
          500: '#FFC000',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f'
        }
      },
      fontFamily: {
        'sans': ['Monda', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}

