import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/features/collections/CollectionHeader";
import { OpenLastGrade } from "@/features/curriculum/CurriculumIndex";
import { GradeLinks } from "@/features/curriculum/GradeLinks";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "pages.curriculum" });
  return { title: t("title") };
}

export default async function CurriculumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.curriculum");
  return (
    <>
      <OpenLastGrade />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")}>
        <GradeLinks />
      </PageHeader>
      <Container className="pb-24">
        <EmptyState title={t("empty")} description={t("emptyText")} />
      </Container>
    </>
  );
}
