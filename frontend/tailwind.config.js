/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // ILDIZmock brand palette — vibrant blue (logo navy + saturation)
        brand: {
          50: '#EEF2FB',
          100: '#DAE2F6',
          200: '#B4C5EE',
          300: '#88A3E2',
          400: '#4D6FE0',
          500: '#2D4FD8',  // vibrant brand blue (buttons, links)
          600: '#1F3FAB',  // ← logo navy (headings, anchors)
          700: '#1B348C',
          800: '#16296F',
          900: '#122158',
          950: '#0B173E',
        },
        // Accent — vibrant teal (logo teal + saturation)
        teal: {
          50: '#E6FBF5',
          100: '#BFF3E1',
          200: '#8AE7C7',
          400: '#2BD2A8',
          500: '#14B898',  // vibrant teal
          600: '#0F9C80',  // ← deep teal
          700: '#0B7A66',
        },
        // CTA — logo "mock" teal (vibrant green-teal). On-brand, energetic,
        // warm enough (yashil), qizil emas, sovuq emas.
        cta: {
          50: '#E6FBF5',
          100: '#BFF3E1',
          400: '#2BD2A8',
          500: '#14B898',  // ← vibrant logo teal
          600: '#0F9C80',  // ← deeper teal on hover
          700: '#0B7A66',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#EEF2FB',
          100: '#DAE2F6',
          200: '#B4C5EE',
          300: '#88A3E2',
          400: '#4D6FE0',
          500: '#2D4FD8',
          600: '#1F3FAB',
          700: '#1B348C',
          800: '#16296F',
          900: '#122158',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(37, 99, 235, 0.08), 0 10px 20px -2px rgba(37, 99, 235, 0.06)',
        'brand-sm': '0 1px 3px rgba(37, 99, 235, 0.08)',
        'brand-md': '0 4px 12px rgba(37, 99, 235, 0.10)',
        'brand-lg': '0 12px 28px rgba(37, 99, 235, 0.14)',
        'brand-xl': '0 24px 48px rgba(37, 99, 235, 0.18)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 50%, #14B8A6 100%)',
        'gradient-hero': 'linear-gradient(135deg, #1E40AF 0%, #2563EB 35%, #14B8A6 100%)',
        'gradient-brand-soft': 'linear-gradient(135deg, #DBEAFE 0%, #CCFBF1 100%)',
        'gradient-cta': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
