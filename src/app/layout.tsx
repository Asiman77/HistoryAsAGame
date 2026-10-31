import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Serif, Noto_Serif_Display } from "next/font/google";
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
    <html lang="az" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
