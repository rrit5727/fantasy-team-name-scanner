/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#00d9a3",
          50: "#e6fff9",
          100: "#ccfff3",
          200: "#99ffe7",
          300: "#66ffdb",
          400: "#33ffcf",
          500: "#00d9a3",
          600: "#00a67d",
          700: "#00805e",
          800: "#005a42",
          900: "#003326",
          foreground: "#0a1f1a"
        },
        secondary: {
          DEFAULT: "#1a3d35",
          foreground: "#e0e0e0"
        },
        destructive: {
          DEFAULT: "#ff6464",
          foreground: "#ffffff"
        },
        muted: {
          DEFAULT: "#0d2e26",
          foreground: "#8a9a96"
        },
        accent: {
          DEFAULT: "#ffa500",
          foreground: "#0a1f1a"
        },
        card: {
          DEFAULT: "#0a1f1a",
          foreground: "#e0e0e0"
        },
        popover: {
          DEFAULT: "#0a1f1a",
          foreground: "#e0e0e0"
        }
      },
      borderRadius: {
        lg: "20px",
        md: "12px",
        sm: "8px"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}

