import type { Metadata, Viewport } from "next";
import { fontVars } from "@/styles/fonts";
import "./globals.css";

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
