import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          disabled: "var(--color-accent-disabled)",
          foreground: "hsl(var(--accent-foreground))",
        },
        "bg-page": "var(--color-bg-page)",
        "bg-sidebar": "var(--color-bg-sidebar)",
        "bg-surface": "var(--color-bg-surface)",
        border: "var(--color-border)",
        "border-focus": "var(--color-border-focus)",
        "border-error": "var(--color-border-error)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-link": "var(--color-text-link)",
        error: "var(--color-error)",
        success: "var(--color-success)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      zIndex: {
        base: "var(--z-base)",
        sidebar: "var(--z-sidebar)",
        header: "var(--z-header)",
        dropdown: "var(--z-dropdown)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
      },
    },
  },
};

export default config;
