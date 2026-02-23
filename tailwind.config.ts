import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "720px",
        md: "720px",
        lg: "720px",
        xl: "720px",
        "2xl": "720px",
      },
    },
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        surface2: "rgb(var(--surface2-rgb) / <alpha-value>)",
        surface3: "rgb(var(--surface3-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        border2: "rgb(var(--border2-rgb) / <alpha-value>)",
        input: "rgb(var(--input-rgb) / <alpha-value>)",
        ring: "rgb(var(--ring-rgb) / <alpha-value>)",
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        accent2: "rgb(var(--accent2-rgb) / <alpha-value>)",
        accent3: "rgb(var(--accent3-rgb) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground-rgb) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary-rgb) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground-rgb) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive-rgb) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground-rgb) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted-bg-rgb) / <alpha-value>)",
          foreground: "rgb(var(--muted-rgb) / <alpha-value>)",
          deep: "rgb(var(--muted2-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground-rgb) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover-rgb) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground-rgb) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card-rgb) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground-rgb) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-background-rgb) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-foreground-rgb) / <alpha-value>)",
          primary: "rgb(var(--sidebar-primary-rgb) / <alpha-value>)",
          "primary-foreground": "rgb(var(--sidebar-primary-foreground-rgb) / <alpha-value>)",
          accent: "rgb(var(--sidebar-accent-rgb) / <alpha-value>)",
          "accent-foreground": "rgb(var(--sidebar-accent-foreground-rgb) / <alpha-value>)",
          border: "rgb(var(--sidebar-border-rgb) / <alpha-value>)",
          ring: "rgb(var(--sidebar-ring-rgb) / <alpha-value>)",
        },
        // Team colors
        team: {
          1: "rgb(var(--team-1-rgb) / <alpha-value>)",
          2: "rgb(var(--team-2-rgb) / <alpha-value>)",
          3: "rgb(var(--team-3-rgb) / <alpha-value>)",
          4: "rgb(var(--team-4-rgb) / <alpha-value>)",
          5: "rgb(var(--team-5-rgb) / <alpha-value>)",
          6: "rgb(var(--team-6-rgb) / <alpha-value>)",
          7: "rgb(var(--team-7-rgb) / <alpha-value>)",
          8: "rgb(var(--team-8-rgb) / <alpha-value>)",
        },
        // Podium colors
        gold: "rgb(var(--gold-rgb) / <alpha-value>)",
        silver: "rgb(var(--silver-rgb) / <alpha-value>)",
        bronze: "rgb(var(--bronze-rgb) / <alpha-value>)",
        // Status colors
        info: "rgb(var(--info-rgb) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Syne"', '"DM Sans"', "sans-serif"],
      },
      fontSize: {
        "display-lg": ["clamp(2rem, 5vw, 3.2rem)", { lineHeight: "1.05", fontWeight: "800", letterSpacing: "-0.025em" }],
        "display-md": ["2.4rem", { lineHeight: "1.12", fontWeight: "800", letterSpacing: "-0.025em" }],
        "display-sm": ["2rem", { lineHeight: "1.15", fontWeight: "800", letterSpacing: "-0.025em" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "bounce-in": {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.38s cubic-bezier(.22,.61,.36,1) both",
        "bounce-in": "bounce-in 0.6s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
