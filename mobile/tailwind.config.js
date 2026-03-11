/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // AMG Brand — dark slate primary with gold/amber accent
        border: 'hsl(220, 13%, 91%)',
        input: 'hsl(220, 13%, 91%)',
        ring: 'hsl(43, 96%, 56%)',
        background: 'hsl(0, 0%, 100%)',
        foreground: 'hsl(222, 47%, 11%)',
        primary: {
          DEFAULT: 'hsl(222, 47%, 11%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        secondary: {
          DEFAULT: 'hsl(210, 40%, 96%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
        destructive: {
          DEFAULT: 'hsl(0, 84%, 60%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        muted: {
          DEFAULT: 'hsl(210, 40%, 96%)',
          foreground: 'hsl(215, 16%, 47%)',
        },
        accent: {
          DEFAULT: 'hsl(43, 96%, 56%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
        card: {
          DEFAULT: 'hsl(0, 0%, 100%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
        // RAG status colors
        rag: {
          red: 'hsl(0, 84%, 60%)',
          amber: 'hsl(38, 92%, 50%)',
          green: 'hsl(142, 71%, 45%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
