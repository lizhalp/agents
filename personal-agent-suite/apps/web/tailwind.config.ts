import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./auth.ts", "./auth-policy.ts"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#6fc8c9",
          strong: "#4ea8ad"
        },
        ink: "#09131f",
        sand: "#e7d5ba",
        shell: {
          DEFAULT: "#08111c",
          soft: "#0a1728"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        ui: ["var(--font-ui)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 30px 120px rgba(0, 0, 0, 0.42)",
        panel: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 54px rgba(0, 0, 0, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
