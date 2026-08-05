/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'display': ['Cinzel', 'serif'],
        'display-deco': ['Cinzel Decorative', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        parchment: {
          50: '#fdf8f0',
          100: '#f7ecd8',
          200: '#eed9b3',
          300: '#e2c08a',
          400: '#d4a35e',
          500: '#c6863a',
        },
        ink: {
          900: '#0a0a0b',
          800: '#141416',
          700: '#1e1e21',
          600: '#2a2a2e',
        },
        leather: {
          900: '#2c1e14',
          800: '#3d2a1d',
          700: '#543a28',
          600: '#6b4a32',
        },
        brass: {
          400: '#d4af37',
          500: '#b8941f',
          600: '#8a6d16',
        },
        moss: '#4a6741',
        oil: '#2c3e50',
        wine: '#5d1f2a',
        charcoal: '#121212',
        graphite: '#1e1e1e',
      },
      backgroundImage: {
        'leather-texture': "radial-gradient(ellipse at top, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg, #1e1e21, #0a0a0b)",
        'parchment-texture': "radial-gradient(ellipse at top, rgba(0,0,0,0.03), transparent 70%), linear-gradient(180deg, #fdf8f0, #f7ecd8)",
      },
      animation: {
        'page-turn': 'pageTurn 0.6s ease-in-out',
        'wax-stamp': 'waxStamp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glow-brass': 'glowBrass 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pageTurn: {
          '0%': { transform: 'rotateY(0deg)', opacity: '1' },
          '100%': { transform: 'rotateY(-10deg)', opacity: '0.9' },
        },
        waxStamp: {
          '0%': { transform: 'scale(2) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        glowBrass: {
          '0%': { boxShadow: '0 0 5px rgba(212,175,55,0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(212,175,55,0.4)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
