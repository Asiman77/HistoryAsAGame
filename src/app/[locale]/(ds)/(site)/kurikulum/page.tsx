import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRepository } from "@/data";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { OpenLastGrade } from "@/features/curriculum/CurriculumIndex";
import { curriculumGrades } from "@/features/curriculum/data";
import { GradeLinks } from "@/features/curriculum/GradeLinks";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.curriculum" });
  return { title: t("title") };
}

export default async function CurriculumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.curriculum");
  const hasData = (await curriculumGrades(getRepository())).length > 0;
  return (
    <>
      <OpenLastGrade />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} {...(hasData ? { lead: t("pickLead") } : {})}>
        <GradeLinks />
      </PageHeader>
      {hasData ? null : (
        <Container className="pb-24">
          <EmptyState title={t("empty")} description={t("emptyText")} />
        </Container>
      )}
    </>
  );
}
