/**
 * War days → shell steps, at build time. The war screens move to the shell
 * in phase 9; curriculum topics (phase 7) already tell war days with these steps.
 */
import type { Locale } from "@/domain/schema";
import type { ConflictSimulationData } from "@/features/conflicts/model";
import { formatDate } from "@/lib/dates";
import { adapterContext, engineFields, shellDateNote, shellSource, shellTerms, shortPlace } from "./stepAdapter";
import { deriveTemplate } from "./templates";
import type { ShellStep } from "./types";

export function conflictSteps(sim: ConflictSimulationData, locale: Locale): ShellStep[] {
  const c = adapterContext(locale, sim.glossary, sim.themes);
  const { m, tr } = c;
  return sim.steps.map((s, index) => {
    const day = s.day;
    const base = engineFields(s, index, c);
    const summary = tr(day.summary);
    return {
      ...base,
      dateLabel: formatDate(day.date, m),
      kind: m.war.kinds[day.kind],
      nodeLabel: shortPlace(base.placeName),
      template: deriveTemplate({ ...(day.template ? { template: day.template } : {}), warDay: true }),
      stampId: null,
      from: null,
      narrative: null,
      summary,
      sources: day.sources.map(shellSource),
      choice: null,
      battle: null,
      more: { date: shellDateNote(day.date, c), primary: null, terms: shellTerms([summary], c), world: [] },
      age: null,
      portrait: null,
    };
  });
}
