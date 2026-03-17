/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 45px rgba(20, 26, 35, 0.08)",
        glow: "0 0 0 2px rgba(238, 60, 44, 0.2), 0 20px 40px rgba(238, 60, 44, 0.18)"
      },
      colors: {
        brand: {
          red: "#eb3b2d",
          dark: "#171c23",
          gray: "#5a6475",
          soft: "#f4f6fa"
        }
      }
    }
  },
  plugins: []
};