import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRepository } from "@/data";
import type { Locale } from "@/domain/schema";
import { findTopic, topicParams, topicPath } from "@/features/curriculum/data";
import { buildTopic, nextTopic } from "@/features/curriculum/topic";
import { TopicFinal } from "@/features/curriculum/TopicFinal";
import { landOutline } from "@/features/simulation-shell/stepAdapter";
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
  if (!found) return {};
  const t = await getTranslations({ locale, namespace: "pages.topicFinal" });
  return { title: `${t("quizTitle")} · ${tr(found.topic.title, locale as Locale)}` };
}

/** End of a topic (§6.4): the quiz from its steps and the next topic of the grade. */
export default async function TopicFinalPage({ params }: { params: Params }) {
  const { locale, grade, topic } = await params;
  setRequestLocale(locale);
  const repo = getRepository();
  const found = await findTopic(repo, Number(grade), topic);
  if (!found) notFound();
  const t = await getTranslations("pages");
  const gradeLabel = t("curriculum.grade", { grade: ordinal(found.grade.grade) });
  const sim = await buildTopic(repo, found.grade, found.topic, locale as Locale, { grade: gradeLabel, final: t("topicFinal.final") });
  if (!sim) notFound();
  return (
    <TopicFinal
      data={{
        key: sim.shell.key,
        title: sim.shell.title,
        eyebrow: [gradeLabel, found.topic.paragraph].filter(Boolean).join(" · "),
        summary: found.topic.summary ? tr(found.topic.summary, locale as Locale) : null,
        simHref: topicPath(found.grade.grade, found.topic.id),
        gradeHref: `/kurikulum/${found.grade.grade}/`,
        themeId: sim.themeId,
        deck: sim.deck,
        land: landOutline(),
        stepCount: sim.shell.steps.length,
        lastIndex: sim.lastIndex,
        owners: sim.owners,
        next: await nextTopic(repo, found.grade, found.topic.id, locale as Locale),
      }}
    />
  );
}
