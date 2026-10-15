import type { Config } from 'tailwindcss'

/**
 * Identidade "Radar": console noturno em cobalto para a marca (cabeçalho, hero, rodapé)
 * e catálogo claro em tons de gelo para leitura. O coral de sinal marca só o desconto.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Cobalto elétrico: ações e links.
        brand: {
          50: '#eef1ff',
          100: '#dfe4ff',
          200: '#c3ccff',
          300: '#9aa8ff',
          400: '#6878ff',
          500: '#3f50ff',
          600: '#2340ff',
          700: '#1a2fd1',
          800: '#1625a3',
          900: '#121e7a'
        },
        // Gelo: fundo do catálogo.
        surface: {
          50: '#f7f9ff',
          100: '#eef2ff',
          200: '#e3e9fb',
          300: '#d5ddf5',
          400: '#c2cdee',
          500: '#a9b7e3'
        },
        // Noite cobalto: superfícies da marca.
        night: {
          DEFAULT: '#0b1640',
          600: '#22357f',
          700: '#172766',
          800: '#101e52',
          900: '#0b1640'
        },
        // Sinal: desconto real.
        signal: {
          DEFAULT: '#ff4f5e',
          600: '#e8364a'
        },
        // Varredura do radar.
        scan: '#7cf4ff'
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        soft: '0 12px 32px -12px rgba(11, 22, 64, 0.18)',
        card: '0 10px 28px -14px rgba(35, 64, 255, 0.35)'
      },
      borderRadius: {
        xl: '0.75rem'
      },
      keyframes: {
        sweep: { to: { transform: 'rotate(360deg)' } },
        blip: {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '70%, 100%': { transform: 'scale(2.6)', opacity: '0' }
        }
      },
      animation: {
        sweep: 'sweep 6s linear infinite',
        blip: 'blip 2.4s ease-out infinite'
      }
    }
  },
  plugins: []
}

export default config
