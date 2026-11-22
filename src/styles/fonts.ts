import { Alegreya_SC, Cormorant_Garamond, Inter, Montserrat, Noto_Sans, Noto_Serif, Noto_Serif_Display, Spectral_SC } from "next/font/google";

/*
 * Fonts of the new design (§3.3): Noto Serif Display for headings and big
 * numbers, Inter for text and UI. Both are variable fonts, so one file per
 * style covers every weight, and both carry the full Azerbaijani alphabet
 * (ə Ə ğ ı İ ö ü ç ş), checked by tests/e2e/fonts.spec.ts.
 */
export const notoSerifDisplay = Noto_Serif_Display({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-noto-serif-display",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

/*
 * Legacy pages only (ADR-0022): body and period display fonts of the old
 * parchment UI. Removed with the (legacy) route group in phase 14.
 */
const notoSerif = Noto_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-noto-serif",
  display: "swap",
});
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-sans",
  display: "swap",
});
// Each was checked to carry ə Ə ğ ı İ ş ç ö ü; Cinzel, Marcellus and Philosopher were rejected for lacking ə.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant-garamond",
  display: "swap",
  preload: false,
});
const alegreyaSc = Alegreya_SC({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  variable: "--font-alegreya-sc",
  display: "swap",
  preload: false,
});
const spectralSc = Spectral_SC({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  variable: "--font-spectral-sc",
  display: "swap",
  preload: false,
});
const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
  preload: false,
});

/** Class names that define the font variables of the new design. */
export const designFontVars = [notoSerifDisplay, inter].map((f) => f.variable).join(" ");

/** All font variables, for the root <html> while legacy pages exist. */
export const fontVars = [notoSerifDisplay, inter, notoSerif, notoSans, cormorant, alegreyaSc, spectralSc, montserrat]
  .map((f) => f.variable)
  .join(" ");
