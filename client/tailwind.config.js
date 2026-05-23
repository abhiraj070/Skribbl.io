/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#0b1020",
          800: "#11172e",
          700: "#1a2142",
          600: "#252d56",
        },
        brand: {
          50: "#f3f1ff",
          100: "#e9e4ff",
          200: "#d3c9ff",
          300: "#b3a1ff",
          400: "#8e72ff",
          500: "#6d49ff",
          600: "#5a2ff5",
          700: "#4a22d6",
          800: "#3d1eae",
          900: "#311a87",
        },
        accent: {
          400: "#ffd166",
          500: "#ffb703",
          600: "#fb8500",
        },
        success: "#10b981",
        danger: "#ef4444",
      },
      boxShadow: {
        glow: "0 10px 40px -10px rgba(109, 73, 255, 0.45)",
        card: "0 10px 30px -10px rgba(15, 23, 42, 0.25)",
      },
      animation: {
        "float-slow": "float 6s ease-in-out infinite",
        "pop-in": "popIn .3s ease-out",
        "fade-in": "fadeIn .4s ease-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        popIn: {
          "0%": { transform: "scale(.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
