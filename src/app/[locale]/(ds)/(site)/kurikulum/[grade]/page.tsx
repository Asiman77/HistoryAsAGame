import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { loadGrade } from "@/features/curriculum/data";
import { GradeLinks, RememberGrade } from "@/features/curriculum/GradeLinks";
import { GradeScreen } from "@/features/curriculum/GradeScreen";
import { ordinal } from "@/lib/ordinal";
import { GRADES, isGrade } from "@/lib/grades";

type Params = Promise<{ locale: string; grade: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return GRADES.map((g) => ({ grade: String(g) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, grade } = await params;
  const t = await getTranslations({ locale, namespace: "pages.curriculum" });
  return { title: `${t("grade", { grade: ordinal(Number(grade)) })} · ${t("title")}` };
}

/**
 * A grade of "Dərsliklə öyrən": sections and topics from data/curriculum
 * (backend B2). A grade without data shows the empty state; nothing is
 * filled in by hand.
 */
export default async function GradePage({ params }: { params: Params }) {
  const { locale, grade: raw } = await params;
  setRequestLocale(locale);
  const grade = Number(raw);
  if (!isGrade(grade)) notFound();
  const t = await getTranslations("pages.curriculum");
  const data = await loadGrade(getRepository(), grade, locale as Locale);
  return (
    <>
      <RememberGrade grade={grade} />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")}>
        <GradeLinks current={grade} />
      </PageHeader>
      <Container className="pb-24">
        {data && data.sections.length ? (
          <GradeScreen data={data} />
        ) : (
          <EmptyState title={t("empty")} description={t("emptyText")} />
        )}
      </Container>
    </>
  );
}
