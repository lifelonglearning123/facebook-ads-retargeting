import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--brand-rgb) / <alpha-value>)",
          fg: "rgb(var(--brand-fg-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--brand-font)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
