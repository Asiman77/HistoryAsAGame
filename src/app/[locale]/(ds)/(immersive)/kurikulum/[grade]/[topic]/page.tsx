import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { findTopic, topicParams } from "@/features/curriculum/data";
import { buildTopic } from "@/features/curriculum/topic";
import { ShellFallback } from "@/features/simulation-shell/ShellFallback";
import { SimulationShell } from "@/features/simulation-shell/SimulationShell";
import { t as tr } from "@/lib/i18n";
import { ordinal } from "@/lib/ordinal";

type Params = Promise<{ locale: string; grade: string; topic: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return topicParams(getRepository());
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, grade, topic } = await params;
  const found = await findTopic(getRepository(), Number(grade), topic);
  return found ? { title: tr(found.topic.title, locale as Locale), ...(found.topic.summary ? { description: tr(found.topic.summary, locale as Locale) } : {}) } : {};
}

/**
 * A curriculum topic as one simulation (FRONTEND_SPEC §6.4): the person,
 * war and state steps it names, in its own order, in the SimulationShell.
 */
export default async function TopicPage({ params }: { params: Params }) {
  const { locale, grade, topic } = await params;
  setRequestLocale(locale);
  const repo = getRepository();
  const found = await findTopic(repo, Number(grade), topic);
  if (!found) notFound();
  const t = await getTranslations("pages");
  const sim = await buildTopic(repo, found.grade, found.topic, locale as Locale, {
    grade: t("curriculum.grade", { grade: ordinal(found.grade.grade) }),
    final: t("topicFinal.final"),
  });
  if (!sim) notFound();
  return (
    <Suspense fallback={<ShellFallback title={sim.shell.title} subtitle={sim.shell.subtitle} />}>
      <SimulationShell data={sim.shell} />
    </Suspense>
  );
}
