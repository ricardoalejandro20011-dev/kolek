import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Marca Kolek */
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },
        ink: '#111111',
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['4.25rem', { lineHeight: '1.02', letterSpacing: '-0.045em', fontWeight: '640' }],
        'display-lg': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.04em', fontWeight: '640' }],
        'display-md': ['2.375rem', { lineHeight: '1.1', letterSpacing: '-0.032em', fontWeight: '640' }],
        'display-sm': ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '620' }],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(17,17,17,0.04), 0 1px 1px -1px rgba(17,17,17,0.03)',
        card: '0 1px 2px rgba(17,17,17,0.04), 0 8px 24px -12px rgba(17,17,17,0.10)',
        float: '0 2px 4px rgba(17,17,17,0.03), 0 18px 48px -20px rgba(17,17,17,0.22)',
        ring: '0 0 0 1px rgba(17,17,17,0.07)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
