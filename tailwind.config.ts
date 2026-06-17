import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        espresso: {
          50: "#faf6f3",
          100: "#f3e9e1",
          200: "#e6d0bf",
          300: "#d3ad8f",
          400: "#b9855f",
          500: "#9c6b46",
          600: "#7d5236",
          700: "#5e3d29",
          800: "#43291b",
          900: "#2b1810",
          950: "#180d08",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
