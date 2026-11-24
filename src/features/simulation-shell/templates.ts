import { TEMPLATES, type Template } from "./types";

/** What deriveTemplate looks at; adapters pass what their step has. */
export interface TemplateHints {
  /** Explicit template from data (backend B1); wins when valid. */
  template?: string;
  /** The step moves the person or the army along a path. */
  hasRoute?: boolean;
  /** The step is a battle with sides and an outcome. */
  battle?: boolean;
  /** The step is a stage of a state (borders change). */
  stateStage?: boolean;
  /** The step is a day of a war that frees settlements. */
  warDay?: boolean;
}

/** Templates the choreography knows in phase 3; others fall back to `location` until their phase (§15). */
export const IMPLEMENTED: readonly Template[] = ["location", "journey"];

const isTemplate = (v: string | undefined): v is Template => !!v && (TEMPLATES as readonly string[]).includes(v);

/**
 * Template of a step (§5.2). An explicit `template` in the data wins (B1);
 * otherwise it is read from the step: a war day frees settlements, a state
 * stage changes borders, a battle has an outcome, a movement draws a route,
 * anything else is a place.
 */
export function deriveTemplate(h: TemplateHints): Template {
  if (isTemplate(h.template)) return h.template;
  if (h.warDay) return "liberation";
  if (h.stateStage) return "territory";
  if (h.battle) return "battle";
  if (h.hasRoute) return "journey";
  return "location";
}

/** How the choreography treats a template today: unbuilt ones behave as a place (a route, when the step has one, is still drawn). */
export const behaviourOf = (t: Template): Template => (IMPLEMENTED.includes(t) ? t : "location");
