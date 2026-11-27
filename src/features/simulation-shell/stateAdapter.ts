/**
 * State simulation steps → shell steps, at build time. The state screen
 * itself moves to the shell in phase 8; curriculum topics (phase 7) already
 * tell state stages with these steps.
 */
import type { Locale } from "@/domain/schema";
import type { StateSimulationData } from "@/features/states/model";
import { formatDate } from "@/lib/dates";
import { adapterContext, engineFields, shellDateNote, shellSource, shellTerms, shellWorld, shortPlace } from "./stepAdapter";
import { deriveTemplate } from "./templates";
import type { ShellStep } from "./types";

export function stateSteps(sim: StateSimulationData, locale: Locale): ShellStep[] {
  const c = adapterContext(locale, sim.glossary, sim.themes);
  const { m, tr } = c;
  return sim.steps.map((s, index) => {
    const stage = s.stage;
    const base = engineFields(s, index, c);
    const summary = tr(stage.summary);
    return {
      ...base,
      dateLabel: formatDate(stage.date, m),
      kind: m.sim.types[s.icon],
      nodeLabel: shortPlace(base.placeName),
      template: deriveTemplate({ ...(stage.template ? { template: stage.template } : {}), stateStage: true }),
      stampId: null,
      from: null,
      narrative: null,
      summary,
      sources: stage.sources.map(shellSource),
      choice: null,
      battle: null,
      more: { date: shellDateNote(stage.date, c), primary: null, terms: shellTerms([summary], c), world: shellWorld(s.world, s.year, c) },
      age: null,
      portrait: null,
    };
  });
}
