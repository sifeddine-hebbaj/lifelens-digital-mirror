import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        border: "hsl(var(--border))",
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        display: ["var(--font-newsreader)", "serif"],
      },
      boxShadow: { quiet: "0 2px 16px rgba(36, 56, 47, 0.06)" },
    },
  },
  plugins: [],
};

export default config;