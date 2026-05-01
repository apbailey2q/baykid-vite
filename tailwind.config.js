/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#060e24",
        cyan: {
          DEFAULT: "#00c8ff",
          dark: "#0057e7",
        },
        glass: "rgba(255,255,255,0.06)",
      },
      backdropBlur: {
        xl: "20px",
      },
    },
  },
  plugins: [],
}