/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Login/auth screens only; the rest of the app uses the stock palette.
      colors: {
        auth: {
          ink: '#0F2B32', // headings, labels, primary button
          'ink-hover': '#123B3E', // button hover, panel gradient end
          brand: '#1F5C57', // focus border/ring
          accent: '#D9522E', // required marker, links, errors
          muted: '#7C8B87',
          body: '#4C5C5A',
          mint: '#E4EEE8', // selected card
          'err-bg': '#FAECE7',
          'err-border': '#F0997B',
          'err-text': '#993C1D',
          page: '#f9fafb',
        },
      },
    },
  },
  plugins: [],
}

