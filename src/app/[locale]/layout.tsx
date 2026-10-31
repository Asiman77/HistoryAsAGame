import { notFound } from "next/navigation";
import { LOCALES } from "@/domain/schema";
import { isLocale } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  // Only locales that actually have UI strings are built for now.
  return LOCALES.filter((l) => l === "az").map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return children;
}
