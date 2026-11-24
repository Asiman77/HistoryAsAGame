import type { ClaimType, MAP_STYLE_VARIANTS, Mood, PlaceType } from "@/domain/schema";

/** Base-map look of a period (data/themes: mapStyleVariant). */
export type MapVariant = (typeof MAP_STYLE_VARIANTS)[number];

/** [lng, lat] */
export type LngLat = [number, number];

/** Step templates (FRONTEND_SPEC §5.2): how the map behaves for a step. */
export const TEMPLATES = ["location", "journey", "battle", "territory", "liberation", "infographic", "monument", "artifact", "migration", "treaty"] as const;
export type Template = (typeof TEMPLATES)[number];

export interface ShellSource {
  title: string;
  author?: string;
  url?: string;
  note?: string;
}

export interface ShellChoice {
  prompt: string;
  options: { text: string; explanation: string }[];
  historical: number;
  why: string;
}

/**
 * The portrait for the age of a step (spec 2): a work of the person's time,
 * a later artwork or an AI illustration. Without a file the card shows a
 * respectful silhouette and says the portrait is being prepared.
 */
export interface ShellPortrait {
  /** Stable key of the age range ("23-37"): the card crossfades when it changes. */
  key: string;
  src: string | null;
  alt: string;
  /** null: the person's single portrait (no age portraits in the data), kind unknown. */
  kind: "historical" | "artwork" | "ai_illustration" | null;
  ages: { from: number; to: number } | null;
  caption: string | null;
  credit: { author: string | null; license: string | null; url: string | null };
}

/**
 * One step of any simulation, with every string resolved at build time for
 * the page's locale. The shell (map, panel, timeline, choreography) reads
 * only these fields; adapters build them from persons, wars or states.
 */
export interface ShellStep {
  id: string;
  index: number;
  year: number;
  /** "1501" or "9 iyul 1501", approximate prefix included. */
  dateLabel: string;
  title: string;
  /** Kind of step for the header: "Taxta çıxma", "Döyüş"… */
  kind: string;
  /** Short label under the timeline node and in the step buttons. */
  nodeLabel: string;
  template: Template;
  mood: Mood;
  themeId: string;
  claimType: ClaimType;
  center: LngLat;
  zoom: number;
  placeName: string;
  modernName: string | null;
  approximatePlace: boolean;
  /** Smoothed movement path ending at `center`; null when nothing moves. */
  route: LngLat[] | null;
  distanceKm: number;
  /** Political map of the step (public/data/territories/<id>.json), null when none covers the year. */
  snapshotId: string | null;
  mapVariant: MapVariant;
  /** First-person literary text (story mode); null when the step has none. */
  narrative: string | null;
  /** Verified facts only. */
  summary: string;
  sources: ShellSource[];
  related: { label: string; href: string | null }[];
  choice: ShellChoice | null;
  age: { years: number; approximate: boolean } | null;
  portrait: ShellPortrait | null;
}

export interface ShellPlace {
  key: string;
  name: string;
  center: LngLat;
  /** First step that reveals the place on the map. */
  firstStep: number;
}

/** A catalogue place drawn on the map in the years it existed (§7: markers by importance). */
export interface ShellLandmark {
  id: string;
  type: PlaceType;
  /** 1 always visible, 2 regional, 3 only zoomed in. */
  importance: 1 | 2 | 3;
  center: LngLat;
  /** Name per period: the name of the step year is used, the modern one shows on hover. */
  periods: { from: number; to: number; name: string }[];
  modern: string | null;
}

export interface ShellData {
  /** Progress key ("shah-ismayil", "state:afshar"…). */
  key: string;
  kind: "person" | "state" | "conflict";
  title: string;
  /** "Səfəvi dövləti · 1487 — 1524" */
  subtitle: string;
  back: { href: string; label: string };
  /** Link shown after the last step (final screen). */
  final: { href: string; label: string } | null;
  steps: ShellStep[];
  places: ShellPlace[];
  /** Projected land outline for the schematic map (src/features/simulation-shell/map/projection.ts). */
  land: string;
  landmarks: ShellLandmark[];
  /** Capitals (place ids) of each snapshot the steps use. */
  capitals: Record<string, string[]>;
}

export interface CameraView {
  center: LngLat;
  zoom: number;
}

/**
 * What the choreography asks of a map. The SVG map implements it now; the
 * MapLibre stage (phase 4) implements the same interface, so the step
 * choreography does not depend on the map library and is tested with a mock.
 */
export interface MapController {
  /** Static state of a step, no animation: places revealed up to it, past trails, the current route not yet drawn. */
  showStep(index: number): void;
  /** Camera to a view. `duration` 0 jumps. An aborted signal ends the move at its target at once. */
  flyTo(view: CameraView, duration: number, signal: AbortSignal): Promise<void>;
  /** Draws the route of a step with a marker riding it. `duration` 0 draws it at once; abort completes it. */
  drawRoute(index: number, duration: number, signal: AbortSignal): Promise<void>;
}
