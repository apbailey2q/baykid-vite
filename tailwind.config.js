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
        // Workflow status palette — BayKid AI Marketing.
        // Each hue is visually distinct on the navy (#060e24) base.
        // Consumed by StatusBadge variants and STATUS_META in lib/aiMarketing.ts.
        status: {
          draft:      "#fcd34d",
          pending:    "#d8b4fe",
          approved:   "#67e8f9",
          queued:     "#93c5fd",
          scheduled:  "#a5b4fc",
          publishing: "#5eead4",
          posted:     "#6ee7b7",
          failed:     "#fca5a5",
          rejected:   "#fb7185",
          cancelled:  "#fdba74",
        },
      },
      backdropBlur: {
        xl: "20px",
      },
    },
  },
  plugins: [],
}