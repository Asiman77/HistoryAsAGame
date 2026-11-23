import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.compare" });
  return { title: t("title") };
}

/** Phase 10. Until then the legacy compare page serves it (ROUTES.compare). */
export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.compare");
  return <ScreenSkeleton title={t("title")} legacyHref="/compare/" />;
}
