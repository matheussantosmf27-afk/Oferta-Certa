import type { Config } from 'tailwindcss'

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
        // Nova paleta: foco em confiança e energia comercial (tons verdes/teal)
        brand: {
          50: '#f3fbf8',
          100: '#dff7ef',
          200: '#bfefe0',
          300: '#8fe0c6',
          400: '#4fd3a7',
          500: '#12b886',
          600: '#0e9b6e',
          700: '#0b7d56',
          800: '#095e3f',
          900: '#07462f'
        },
        // superfícies claras para leitura prolongada
        surface: {
          50: '#fbfdfc',
          100: '#f6f9f8',
          200: '#eef4f1',
          300: '#e4efe8',
          400: '#d7e9de',
          500: '#c1e0cf'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.06)',
        card: '0 6px 18px rgba(15, 23, 42, 0.06)'
      },
      borderRadius: {
        // reduzimos o raio para evitar estética de template "rounded everything"
        xl: '0.5rem'
      }
    }
  },
  plugins: []
}

export default config
