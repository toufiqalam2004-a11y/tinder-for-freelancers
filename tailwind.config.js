/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          hover: 'var(--color-surface-hover)',
          light: 'var(--color-surface-light)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
        primary: {
          DEFAULT: 'var(--brand-primary, #E11D48)',
          dark: 'var(--brand-primary-hover, #BE123C)',
          light: 'var(--brand-primary-light, #F43F6E)',
          soft: 'var(--brand-primary-soft, rgba(225, 29, 72, 0.12))',
          glow: 'var(--color-primary-glow)',
        },
        secondary: {
          DEFAULT: 'var(--brand-secondary, #D4A373)',
          light: '#E8D5C4',
          dark: '#B58253',
        },
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        success: {
          DEFAULT: '#10b981',
          bg: 'rgba(16, 185, 129, 0.1)',
        },
        error: {
          DEFAULT: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.1)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.1)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'btn': '12px',
        'input': '12px',
        'tag': '20px',
      },
      boxShadow: {
        'glow': '0 0 20px var(--color-primary-glow)',
        'card': 'var(--color-card-shadow)',
        'elevated': 'var(--color-elevated-shadow)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
