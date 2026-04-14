import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Cairo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
