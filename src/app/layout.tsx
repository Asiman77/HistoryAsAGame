import type { Metadata, Viewport } from "next";
import { Alegreya_SC, Cormorant_Garamond, Montserrat, Noto_Sans, Noto_Serif, Noto_Serif_Display, Spectral_SC } from "next/font/google";
import "./globals.css";

// Noto families cover the full Azerbaijani Latin alphabet (ə ğ ı ö ü ç ş).
const display = Noto_Serif_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif-display",
  display: "swap",
});
const serif = Noto_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-noto-serif",
  display: "swap",
});
const sans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-sans",
  display: "swap",
});

// Period display fonts (data/themes: fonts.display). Each was checked to carry
// ə Ə ğ ı İ ş ç ö ü; Cinzel, Marcellus and Philosopher were rejected for lacking ə.
// Not preloaded: the browser fetches one only when a page of that period shows it.
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

const fontVars = [display, serif, sans, cormorant, alegreyaSc, spectralSc, montserrat].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: { default: "Tarixin İçində", template: "%s · Tarixin İçində" },
  description: "Azərbaycan tarixi şəxsiyyətlərinin interaktiv həyat simulyasiyası",
};

export const viewport: Viewport = {
  themeColor: "#f2e6cc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
