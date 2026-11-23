import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { GradeLinks, RememberGrade } from "@/features/curriculum/GradeLinks";
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

/** Grade page: sections and topics come from the curriculum model (phase 7, backend B2); none exist yet. */
export default async function GradePage({ params }: { params: Params }) {
  const { locale, grade: raw } = await params;
  setRequestLocale(locale);
  const grade = Number(raw);
  if (!isGrade(grade)) notFound();
  const t = await getTranslations("pages.curriculum");
  return (
    <>
      <RememberGrade grade={grade} />
      <PageHeader eyebrow={t("eyebrow")} title={t("grade", { grade: ordinal(grade) })}>
        <GradeLinks current={grade} />
      </PageHeader>
      <Container className="pb-24">
        <EmptyState title={t("empty")} description={t("emptyText")} />
      </Container>
    </>
  );
}
