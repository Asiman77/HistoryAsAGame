import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/features/skeleton/ScreenSkeleton";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.teacher" });
  return { title: t("title") };
}

/** Phase 13 (sign-in, classes, topic assignment, projector mode). */
export default async function TeacherPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.teacher");
  return <ScreenSkeleton title={t("title")} empty={{ title: t("empty"), text: t("emptyText") }} />;
}
