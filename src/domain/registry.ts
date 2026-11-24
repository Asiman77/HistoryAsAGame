import type { EntityRef, EntityType, ImageAsset, LocalizedText, PlannedEntity } from "./schema";

/** One indexed entity. `url` is null while it has no page (planned, or a type without simulations). */
export interface RegistryEntry {
  type: EntityType;
  id: string;
  title: LocalizedText;
  url: string | null;
  image?: ImageAsset;
  /** Steps that deep links may point at. */
  steps: Record<string, { title: LocalizedText; year: number }>;
  /** Announced in data/planned.json but not built yet. */
  planned?: boolean;
}

export type Registry = Record<string, RegistryEntry>;

export const refKey = (type: EntityType, id: string) => `${type}:${id}`;

/** Simulation types that have their own pages. Persons moved to the new design in phase 5 (ADR-0022). */
const ROUTES: Partial<Record<EntityType, string>> = { person: "sexsiyyetler", conflict: "conflicts", state: "states", place: "places" };

export function entityPath(type: EntityType, id: string, stepId?: string): string | null {
  const base = ROUTES[type];
  if (!base) return null;
  return `/${base}/${id}/${stepId ? `?step=${stepId}` : ""}`;
}

export interface RegistrySources {
  simulations: { type: EntityType; id: string; title: LocalizedText; image?: ImageAsset; steps: { id: string; title: LocalizedText; year: number }[] }[];
  /** Entities without pages that still exist (places, rulers, battles inside a conflict...). */
  others: { type: EntityType; id: string; title: LocalizedText; image?: ImageAsset; url?: string }[];
  planned: PlannedEntity[];
}

export function buildRegistry({ simulations, others, planned }: RegistrySources): Registry {
  const reg: Registry = {};
  for (const p of planned)
    reg[refKey(p.type, p.id)] = { type: p.type, id: p.id, title: p.title, url: null, steps: {}, planned: true };
  for (const o of others) reg[refKey(o.type, o.id)] = { ...o, url: o.url ?? null, steps: {} };
  for (const s of simulations)
    reg[refKey(s.type, s.id)] = {
      type: s.type,
      id: s.id,
      title: s.title,
      url: entityPath(s.type, s.id),
      ...(s.image ? { image: s.image } : {}),
      steps: Object.fromEntries(s.steps.map((st) => [st.id, { title: st.title, year: st.year }])),
    };
  return reg;
}

/** A ref as the UI needs it: title, link (or none) and the optional step it lands on. */
export interface ResolvedRef {
  type: EntityType;
  id: string;
  title: LocalizedText;
  /** Link to the simulation (with ?step=), null when the target is not available yet. */
  href: string | null;
  /** Entity exists (it may still have no page, e.g. a place). */
  exists: boolean;
  note?: LocalizedText;
  image?: ImageAsset;
  stepTitle?: LocalizedText;
  stepYear?: number;
}

export function resolveRef(ref: EntityRef, reg: Registry): ResolvedRef {
  const e = reg[refKey(ref.type, ref.id)];
  const live = !!e && !e.planned;
  const step = live && ref.stepId ? e.steps[ref.stepId] : undefined;
  return {
    type: ref.type,
    id: ref.id,
    title: e?.title ?? ref.label ?? { az: ref.id },
    href: live && e.url ? (entityPath(ref.type, ref.id, step ? ref.stepId : undefined) ?? e.url) : null,
    exists: live,
    ...(ref.note ? { note: ref.note } : {}),
    ...(e?.image ? { image: e.image } : {}),
    ...(step ? { stepTitle: step.title, stepYear: step.year } : {}),
  };
}

export interface RefIssue {
  level: "error" | "warning";
  message: string;
}

/**
 * Missing targets are warnings (they may be added later); a step id on an
 * entity that exists but has no such step is an error, as is a ref without any
 * name to show.
 */
export function checkRef(ref: EntityRef, reg: Registry, where: string): RefIssue[] {
  const e = reg[refKey(ref.type, ref.id)];
  if (!e) {
    return [
      { level: "warning", message: `${where}: ${ref.type}:${ref.id} hələ mövcud deyil (passiv göstəriləcək)` },
      ...(ref.label ? [] : [{ level: "error" as const, message: `${where}: mövcud olmayan ${ref.type}:${ref.id} üçün label lazımdır` }]),
    ];
  }
  if (e.planned) return [{ level: "warning", message: `${where}: ${ref.type}:${ref.id} planlaşdırılıb, hələ qurulmayıb` }];
  if (ref.stepId && !e.steps[ref.stepId])
    return [{ level: "error", message: `${where}: ${ref.type}:${ref.id} daxilində ${ref.stepId} mərhələsi yoxdur` }];
  return [];
}
