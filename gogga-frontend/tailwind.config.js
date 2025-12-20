/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        quicksand: ['var(--font-quicksand)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Savanna Color Palette - Warm Earth Tones
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          950: 'var(--color-primary-950)',
        },
        // SA-Inspired Accent Colors
        accent: {
          gold: 'var(--color-accent-gold)',
          'gold-light': 'var(--color-accent-gold-light)',
          'gold-dark': 'var(--color-accent-gold-dark)',
          teal: 'var(--color-accent-teal)',
          coral: 'var(--color-accent-coral)',
          blue: 'var(--color-accent-blue)',
        },
        // Legacy SA colors
        'sa': {
          green: 'var(--color-sa-green)',
          gold: 'var(--color-sa-gold)',
          red: 'var(--color-sa-red)',
          blue: 'var(--color-sa-blue)',
          black: 'var(--color-sa-black)',
        },
        // Status Colors
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        // Dark Mode Colors
        dark: {
          bg: 'var(--color-dark-bg)',
          surface: 'var(--color-dark-surface)',
          border: 'var(--color-dark-border)',
          text: 'var(--color-dark-text)',
          muted: 'var(--color-dark-muted)',
        },
      },
      // Border Radius
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },
      // Shadows
      boxShadow: {
        soft: 'var(--shadow-soft)',
        medium: 'var(--shadow-medium)',
        elevated: 'var(--shadow-elevated)',
      },
      // Typography
      fontSize: {
        xs: 'var(--text-fluid-xs)',
        sm: 'var(--text-fluid-sm)',
        base: 'var(--text-fluid-base)',
        lg: 'var(--text-fluid-lg)',
        xl: 'var(--text-fluid-xl)',
        '2xl': 'var(--text-fluid-2xl)',
        '3xl': 'var(--text-fluid-3xl)',
      },
    },
  },
};
