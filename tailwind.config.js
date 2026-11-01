/** Tokens de la identidad de PrestoBar (Fase 1). Los colores salen de variables CSS en src/index.css,
 *  así el modo claro, el oscuro y la cocina usan las mismas clases. */
/** @type {import('tailwindcss').Config} */
const v = name => `var(--${name})`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), "surface-2": v("surface-2"), "surface-3": v("surface-3"),
        ink: v("ink"), "ink-2": v("ink-2"), "ink-3": v("ink-3"), line: v("line"), focus: v("focus"),
        brand: v("brand"), "brand-deep": v("brand-deep"), "brand-text": v("brand-text"), "brand-soft": v("brand-soft"), "on-brand": v("on-brand"),
        accent: v("accent"), "accent-deep": v("accent-deep"), "on-accent": v("on-accent"),
        maiz: v("maiz"), "maiz-soft": v("maiz-soft"), "on-maiz": v("on-maiz"), toborochi: v("toborochi"),
        ok: v("ok"), "ok-soft": v("ok-soft"), warn: v("warn"), "warn-soft": v("warn-soft"),
        bad: v("bad"), "bad-soft": v("bad-soft"), info: v("info"), "info-soft": v("info-soft"),
        grid: v("grid"), axis: v("axis"),
        "r-admin": v("r-admin"), "r-cajero": v("r-cajero"), "r-cocina": v("r-cocina"), "r-mesero": v("r-mesero"),
        "r-tienda": v("r-tienda"), "r-delivery": v("r-delivery"), "r-cliente": v("r-cliente"), "on-role": v("on-role"),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Hanken Grotesk"', "Segoe UI", "Arial", "sans-serif"],
        sans: ['"Hanken Grotesk"', "Segoe UI", "Arial", "sans-serif"],
      },
      // Escala de B1: 12 / 14 / 16 / 20 / 28 / 36 / 52
      fontSize: { xs: ["12px", "1.4"], sm: ["14px", "1.45"], base: ["16px", "1.45"], lg: ["20px", "1.3"], xl: ["28px", "1.15"], "2xl": ["36px", "1.1"], "3xl": ["52px", "1.05"] },
      borderRadius: { sm: v("radius-sm"), md: v("radius-md"), lg: v("radius-lg") },
      boxShadow: { 1: v("shadow-1"), 2: v("shadow-2") },
    },
  },
  plugins: [],
};
