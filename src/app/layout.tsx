import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarixin İçində",
  description: "Azərbaycan tarixi şəxsiyyətlərinin interaktiv həyat simulyasiyası",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
