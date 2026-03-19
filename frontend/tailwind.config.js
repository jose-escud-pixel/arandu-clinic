/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        border: "#E5E0D6",
        input: "#E5E0D6",
        ring: "#D97757",
        background: "#FDFCF8",
        foreground: "#2D2A26",
        primary: {
          50: "#fbf7f6",
          100: "#f5ede9",
          200: "#ebd9d2",
          300: "#dec5bb",
          400: "#d0ad9f",
          500: "#D97757",
          600: "#b85c3f",
          700: "#96462e",
          800: "#783624",
          900: "#632d20",
          DEFAULT: "#D97757",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#4B7F52",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#E05252",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F5F2EB",
          foreground: "#787570",
        },
        accent: {
          DEFAULT: "#F2C94C",
          foreground: "#2D2A26",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#2D2A26",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#2D2A26",
        },
        charcoal: {
          50: "#f6f6f5",
          100: "#e7e7e5",
          200: "#d1d0cd",
          300: "#b0afaa",
          400: "#8a8983",
          500: "#6f6e68",
          600: "#5c5b56",
          700: "#4c4b47",
          800: "#42413e",
          900: "#2D2A26",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(45, 42, 38, 0.04)',
        'hover': '0 8px 16px rgba(45, 42, 38, 0.08)',
        'popover': '0 12px 32px rgba(45, 42, 38, 0.12)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};