import type { PersonProgress, QuizResult } from "@/lib/progress";
import type { SectionData, TopicCardData } from "./data";

/** Status of a topic in the list (FRONTEND_SPEC §6.3): tamamlandı / davam edir / yeni / hazırlanır. */
export type TopicStatus = "done" | "progress" | "new" | "preparing";

/** Progress key of a topic simulation in tarix:progress. */
export const topicKey = (id: string) => `topic:${id}`;

export function topicStatus(topic: Pick<TopicCardData, "ready">, p: PersonProgress | undefined): TopicStatus {
  if (!topic.ready) return "preparing";
  if (p?.completed) return "done";
  return p ? "progress" : "new";
}

/** How far the student got in a topic, 0..1 (the furthest step reached). */
export function topicShare(topic: Pick<TopicCardData, "ready" | "steps">, p: PersonProgress | undefined): number {
  if (!topic.ready || !p) return 0;
  if (p.completed) return 1;
  return Math.min(1, (p.furthest + 1) / Math.max(1, topic.steps));
}

/** Ring of a section: the mean progress of the topics that can be opened; 0 when none can. */
export function sectionShare(section: Pick<SectionData, "topics">, progress: Record<string, PersonProgress>): number {
  const ready = section.topics.filter((t) => t.ready);
  if (!ready.length) return 0;
  return ready.reduce((sum, t) => sum + topicShare(t, progress[topicKey(t.id)]), 0) / ready.length;
}

/** The section to open first: the first with a topic left to do, else the first. */
export function firstOpenSection(sections: readonly SectionData[], progress: Record<string, PersonProgress>): string | null {
  const open = sections.find((s) => s.topics.some((t) => t.ready && !progress[topicKey(t.id)]?.completed));
  return (open ?? sections[0])?.id ?? null;
}

export interface TopicRowState {
  status: TopicStatus;
  share: number;
  quiz: QuizResult | null;
}

export function topicRow(topic: TopicCardData, progress: Record<string, PersonProgress>, quizzes: Record<string, QuizResult>): TopicRowState {
  const p = progress[topicKey(topic.id)];
  return { status: topicStatus(topic, p), share: topicShare(topic, p), quiz: quizzes[topicKey(topic.id)] ?? null };
}
