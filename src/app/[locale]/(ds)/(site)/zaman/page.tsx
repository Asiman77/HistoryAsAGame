import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.timeline" });
  return { title: t("title") };
}

/** Phase 6. Until then the legacy timeline serves it (ROUTES.timeline). */
export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.timeline");
  return <ScreenSkeleton title={t("title")} legacyHref="/timeline/" />;
}
