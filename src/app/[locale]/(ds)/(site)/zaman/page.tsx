import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { loadZamanData } from "@/features/timeline/data";
import { TimelineScreen } from "@/features/timeline/TimelineScreen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.timeline" });
  return { title: t("title") };
}

/** Zaman şkalası (FRONTEND_SPEC §6.2): ?year= and ?layers= are read in the browser. */
export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.timeline");
  const data = await loadZamanData(getRepository(), locale as Locale);
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<div className="min-h-[760px]" data-testid="timeline-loading" />}>
        <TimelineScreen data={data} />
      </Suspense>
    </>
  );
}
