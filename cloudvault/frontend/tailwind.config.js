/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- CloudVault "vault dial" design system ---
        // ink: the deep chrome around the product (sidebar, header, modals' backdrop)
        ink: {
          DEFAULT: "#12162B",
          light: "#1D2340",
        },
        // paper: cool steel-tinted canvas (deliberately not the common warm-cream default)
        paper: {
          DEFAULT: "#EEF1F6",
          raised: "#FFFFFF",
        },
        // steel: borders and secondary text
        steel: {
          DEFAULT: "#4B5567",
          soft: "#8993A8",
          hairline: "#D7DCE5",
        },
        // brass: the single accent color, used for primary actions and the vault dial
        brass: {
          DEFAULT: "#B8842E",
          dark: "#8F6620",
          soft: "#F2E4C8",
        },
        // vault-green: "secured / encrypted / healthy" state color
        vault: {
          green: "#2F8F6C",
          greenSoft: "#DCEEE6",
        },
        // signal-red: destructive / error state color
        signal: {
          red: "#C1443C",
          redSoft: "#F6DEDC",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        body: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(18,22,43,0.06), 0 4px 16px rgba(18,22,43,0.06)",
      },
    },
  },
  plugins: [],
};
