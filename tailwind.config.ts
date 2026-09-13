import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        ink: "hsl(var(--ink))",
        "ink-muted": "hsl(var(--ink-muted))",
        border: "hsl(var(--border))",
        brand: {
          DEFAULT: "hsl(var(--brand))",
          strong: "hsl(var(--brand-strong))",
          soft: "hsl(var(--brand-soft))",
        },
        cta: {
          DEFAULT: "hsl(var(--cta))",
          strong: "hsl(var(--cta-strong))",
          ink: "hsl(var(--cta-ink))",
        },
        status: {
          diajukan: { bg: "hsl(var(--status-diajukan-bg))", text: "hsl(var(--status-diajukan-text))" },
          progress: { bg: "hsl(var(--status-progress-bg))", text: "hsl(var(--status-progress-text))" },
          waiting: { bg: "hsl(var(--status-waiting-bg))", text: "hsl(var(--status-waiting-text))" },
          info: { bg: "hsl(var(--status-info-bg))", text: "hsl(var(--status-info-text))" },
          success: { bg: "hsl(var(--status-success-bg))", text: "hsl(var(--status-success-text))" },
          danger: { bg: "hsl(var(--status-danger-bg))", text: "hsl(var(--status-danger-text))" },
        },
        priority: {
          low: "hsl(var(--priority-low))",
          normal: "hsl(var(--priority-normal))",
          high: "hsl(var(--priority-high))",
          urgent: "hsl(var(--priority-urgent))",
        },
        danger: "hsl(var(--danger))",
        warning: "hsl(var(--warning))",
        success: "hsl(var(--success))",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        card: "0 1px 2px hsl(var(--ink) / 0.04), 0 1px 0 hsl(var(--ink) / 0.03)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
