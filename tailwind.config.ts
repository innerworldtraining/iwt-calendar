import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        elites: {
          DEFAULT: "#f59e0b",
          bg: "#fef3c7",
          text: "#78350f",
          soft: "#fffbeb",
        },
        plats: {
          DEFAULT: "#8b5cf6",
          bg: "#ede9fe",
          text: "#4c1d95",
          soft: "#f5f3ff",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
