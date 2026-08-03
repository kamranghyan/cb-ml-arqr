/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette
        gold: {
          50:  '#fdf8ee',
          100: '#f7e9c8',
          200: '#f0d49e',
          300: '#e8bc6e',
          400: '#14b8a6',  // primary gold
          500: '#c4873c',
          600: '#a86d2c',
          700: '#8a551f',
          800: '#6b3f14',
          900: '#4a2a0a',
        },
        surface: {
          DEFAULT: '#ffffff',
          50:  '#1a1714',
          100: '#111114',
          200: '#0f0f11',
          300: '#0d0d0f',
          400: '#0c0c0e',
          500: '#0a0a0b',
        },
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        serif:   ['Playfair Display', 'serif'],
        mono:    ['DM Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      animation: {
        'pulse-slow':  'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'blink':       'blink 1.4s ease-in-out infinite',
        'shimmer':     'shimmer 2.8s ease-in-out infinite',
        'timer-pulse': 'timerpulse 1s ease-in-out infinite',
        'new-flash':   'newflash 0.6s ease',
        'spin-slow':   'spin 2s linear infinite',
      },
      keyframes: {
        blink:      { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.2' } },
        shimmer:    { '0%': { left: '-100%' }, '60%,100%': { left: '140%' } },
        timerpulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        newflash:   {
          '0%':   { borderColor: 'rgba(255,167,38,0.8)', boxShadow: '0 0 20px rgba(255,167,38,0.3)' },
          '100%': { borderColor: 'rgba(255,255,255,0.06)', boxShadow: 'none' },
        },
      },
      boxShadow: {
        'gold-sm': '0 0 0 1px rgba(212,163,78,0.2)',
        'gold':    '0 0 20px rgba(212,163,78,0.15)',
        'shell':   '0 30px 80px rgba(0,0,0,0.6)',
        'card':    '0 4px 24px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
