/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {},
    fontFamily: {
        sans: [
            '"Hind", sans-serif',
        ]
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
}

