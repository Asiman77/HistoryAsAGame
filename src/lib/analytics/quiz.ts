import type { QuizQuestion } from "@/domain/schema";

/** A quiz question that still knows its step, so an answer can be reported per question (docs/adr/0020). */
export type TrackedQuizQuestion = QuizQuestion & { stepKey?: string; questionIndex?: number };

/** The quizzes of all steps, in step order, each tagged with its step and position. */
export function quizOf(steps: readonly { id: string; quiz?: QuizQuestion[] }[]): TrackedQuizQuestion[] {
  return steps.flatMap((s) => (s.quiz ?? []).map((q, i) => ({ ...q, stepKey: s.id, questionIndex: i })));
}
