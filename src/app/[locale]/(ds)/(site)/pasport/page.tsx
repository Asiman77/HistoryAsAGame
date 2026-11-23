import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.passport" });
  return { title: t("title") };
}

/** Stamps arrive with the person final (phase 5). */
export default async function PassportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.passport");
  return <ScreenSkeleton eyebrow={t("eyebrow")} title={t("title")} empty={{ title: t("empty"), text: t("emptyText") }} />;
}
