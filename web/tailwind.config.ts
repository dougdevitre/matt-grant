import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Ledger & Banner" civic identity — see globals.css for usage.
        ink: "#0F2540", // primary authority navy
        field: "#16365C", // deep field blue
        gold: "#2563EB", // campaign accent BLUE (token name kept for compatibility — red/white/blue palette)
        brick: "#B5343B", // red — urgency / primary CTA
        paper: "#FBFAF6", // warm white
        slate: "#5A6472", // muted body / captions
        line: "#E4E2DA", // hairline borders
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.22em",
      },
      maxWidth: {
        prose: "68ch",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(15,37,64,0.04), 0 12px 32px -16px rgba(15,37,64,0.28)",
        lift: "0 24px 60px -28px rgba(15,37,64,0.45)",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "0.9" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.7s cubic-bezier(0.22,1,0.36,1) both",
        sweep: "sweep 8s linear infinite",
        "fade-in": "fade-in 1.2s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
