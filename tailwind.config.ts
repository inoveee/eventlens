import type { Config } from "tailwindcss";

/** Один системный шрифтовой стек на всё приложение (SF Pro на Apple,
 *  системный гротеск везде) — Apple-эстетика вместо моноширинного терминала.
 *  Классы font-mono/font-heading сохранены для совместимости разметки,
 *  но указывают на тот же стек. */
const systemSans = [
  "var(--font-sans)",
  "-apple-system",
  "BlinkMacSystemFont",
  "SF Pro Display",
  "SF Pro Text",
  "Helvetica Neue",
  "Segoe UI",
  "Roboto",
  "Inter",
  "system-ui",
  "sans-serif",
];

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: systemSans,
        mono: systemSans,
        heading: systemSans,
      },
      animation: {
        "boot-line": "boot-line 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "slide-up": "slide-up 0.32s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "grid-reveal": "fade-rise 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "crosshair-spin": "spin 0.9s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
