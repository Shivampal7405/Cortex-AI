import type { Config } from 'tailwindcss'

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/popup/index.html",
    "./src/options/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        provider: {
          claude: '#D97706',
          chatgpt: '#10A37F',
          gemini: '#4285F4',
          grok: '#000000',
        }
      }
    },
  },
  plugins: [],
} satisfies Config
