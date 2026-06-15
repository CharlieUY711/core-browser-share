import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        core: {
          bg: "#0a0a0f",
          surface: "#13131a",
          border: "#1e1e2e",
          accent: "#6366f1",
          "accent-dim": "#4f52c9",
          muted: "#3f3f5a",
          text: "#e2e2f0",
          "text-muted": "#7c7c9e",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
