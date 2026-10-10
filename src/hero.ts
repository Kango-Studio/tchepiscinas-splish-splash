// HeroUI v2 theme plugin (Tailwind v4 via `@plugin` in styles.css).
// Colors mirror the Tchê Piscinas brand tokens defined in styles.css.
import { heroui } from "@heroui/theme";

export default heroui({
  prefix: "heroui",
  defaultTheme: "light",
  themes: {
    light: {
      colors: {
        background: "#FFFFFF",
        foreground: "#001D33",
        focus: "#007CC0",
        primary: {
          50: "#E6F4FB",
          100: "#D0F2FF",
          200: "#A6DDF5",
          300: "#6CC3EC",
          400: "#2FA1DB",
          500: "#007CC0",
          600: "#00679F",
          700: "#005290",
          800: "#003F6E",
          900: "#002B4C",
          DEFAULT: "#005290",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#007CC0",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#FFC31A",
          foreground: "#001D33",
        },
        success: {
          DEFAULT: "#1F9D55",
          foreground: "#FFFFFF",
        },
        danger: {
          DEFAULT: "#DF2225",
          foreground: "#FFFFFF",
        },
      },
    },
  },
});
