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
        navy: {
          DEFAULT: "hsl(var(--navy))",
          soft: "hsl(var(--navy-soft))",
        },
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
          diverifikasi: { bg: "hsl(var(--status-diverifikasi-bg))", text: "hsl(var(--status-diverifikasi-text))" },
          diteruskan: { bg: "hsl(var(--status-diteruskan-bg))", text: "hsl(var(--status-diteruskan-text))" },
          diterima: { bg: "hsl(var(--status-diterima-bg))", text: "hsl(var(--status-diterima-text))" },
          ditangani: { bg: "hsl(var(--status-ditangani-bg))", text: "hsl(var(--status-ditangani-text))" },
          menunggu: { bg: "hsl(var(--status-menunggu-bg))", text: "hsl(var(--status-menunggu-text))" },
          selesai: { bg: "hsl(var(--status-selesai-bg))", text: "hsl(var(--status-selesai-text))" },
          ditolak: { bg: "hsl(var(--status-ditolak-bg))", text: "hsl(var(--status-ditolak-text))" },
          dikembalikan: { bg: "hsl(var(--status-dikembalikan-bg))", text: "hsl(var(--status-dikembalikan-text))" },
          dieskalasikan: { bg: "hsl(var(--status-dieskalasikan-bg))", text: "hsl(var(--status-dieskalasikan-text))" },
          ditunda: { bg: "hsl(var(--status-ditunda-bg))", text: "hsl(var(--status-ditunda-text))" },
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
        sm: "8px",
        md: "12px",
        lg: "18px",
        xl: "20px",
      },
      boxShadow: {
        card: "0 1px 2px hsl(var(--ink) / 0.05), 0 2px 8px hsl(var(--ink) / 0.04)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
