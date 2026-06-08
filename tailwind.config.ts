import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          dark: '#15431F',
          medium: '#1F4A26',
          light: '#D4E8D6',
          'very-light': '#F0F8F1',
        },
        brand: {
          primary: '#15431F',
          secondary: '#1F4A26',
          accent: '#D4E8D6',
        },
      },
    },
  },
  plugins: [],
}

export default config
