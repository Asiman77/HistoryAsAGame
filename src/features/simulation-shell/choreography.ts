/**
 * Step transition choreography (FRONTEND_SPEC §5.3), independent of the map
 * library and of React:
 *
 *   0 ms     panel content fades out and rises 8 px (200 ms)
 *   100 ms   period theme crossfades (CSS, 750 ms); music follows in phase 12
 *   150 ms   camera flies (900–1800 ms by distance, ease cubic-bezier(.65,0,.35,1))
 *   150 ms   year and age counters roll (600 ms); the portrait crossfades (500 ms)
 *   arrival  the route is drawn (1200–2000 ms) with a marker riding it
 *   ~arrival new content fades in, title → text → chips 40 ms apart
 *
 * The new text is readable 0.9–2.0 s after the click; a journey's route keeps
 * drawing beside it and never blocks anything. A new click while a transition
 * runs aborts it: every part jumps to its end state and the next one starts.
 */
import type { CameraView, LngLat, MapController, ShellStep } from "./types";

export const PANEL_OUT_MS = 200;
export const THEME_AT_MS = 100;
export const CAMERA_AT_MS = 150;
export const COUNTERS_MS = 600;
export const PORTRAIT_MS = 500;
export const STAGGER_MS = 40;
export const CAMERA_MIN_MS = 900;
export const CAMERA_MAX_MS = 1800;
export const ROUTE_MIN_MS = 1200;
export const ROUTE_MAX_MS = 2000;
/** Below this the camera does not move (same place, same zoom). */
const SAME_PLACE_KM = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Great-circle distance in km (no turf on the client). */
export function haversineKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface TransitionPlan {
  panelOut: number;
  themeAt: number;
  camera: { at: number; duration: number };
  route: { at: number; duration: number } | null;
  counters: { at: number; duration: number };
  portrait: { at: number; duration: number };
  contentAt: number;
  stagger: number;
  /** When the new text has fully appeared. */
  readableAt: number;
  /** When everything, the route included, has finished. */
  doneAt: number;
}

type StepGeo = Pick<ShellStep, "center" | "zoom" | "route" | "distanceKm">;

/** Timings of a transition from `from` (null on first load) to `to`. */
export function planTransition(from: StepGeo | null, to: StepGeo, { reduced }: { reduced: boolean }): TransitionPlan {
  // Any step that moves draws its route (a march to a battle too), whatever its template.
  const hasRoute = !!to.route && to.route.length > 1;
  if (reduced || !from) {
    // Reduced motion and the first paint: jump, then a short fade (§11).
    const fade = reduced ? 150 : 0;
    return {
      panelOut: 0,
      themeAt: 0,
      camera: { at: 0, duration: 0 },
      route: hasRoute ? { at: 0, duration: 0 } : null,
      counters: { at: 0, duration: 0 },
      portrait: { at: 0, duration: 0 },
      contentAt: 0,
      stagger: 0,
      readableAt: fade,
      doneAt: fade,
    };
  }
  const km = haversineKm(from.center, to.center);
  const still = km < SAME_PLACE_KM && Math.abs(from.zoom - to.zoom) < 0.2;
  const cameraMs = still ? 0 : clamp(CAMERA_MIN_MS + km * 0.9, CAMERA_MIN_MS, CAMERA_MAX_MS);
  const arrival = CAMERA_AT_MS + cameraMs;
  const route = hasRoute ? { at: arrival, duration: clamp(ROUTE_MIN_MS + to.distanceKm * 0.8, ROUTE_MIN_MS, ROUTE_MAX_MS) } : null;
  // The text comes in as the camera settles, never before the old text has gone.
  const contentAt = Math.max(PANEL_OUT_MS + 50, arrival - 250);
  const readableAt = contentAt + 3 * STAGGER_MS + 300;
  return {
    panelOut: PANEL_OUT_MS,
    themeAt: THEME_AT_MS,
    camera: { at: CAMERA_AT_MS, duration: cameraMs },
    route,
    counters: { at: CAMERA_AT_MS, duration: COUNTERS_MS },
    portrait: { at: CAMERA_AT_MS, duration: PORTRAIT_MS },
    contentAt,
    stagger: STAGGER_MS,
    readableAt,
    doneAt: Math.max(readableAt, route ? route.at + route.duration : arrival, CAMERA_AT_MS + COUNTERS_MS),
  };
}

/** What a transition drives besides the map: the panel, the theme and the counters live in React state. */
export interface TransitionActors {
  map: MapController;
  /** Old panel content leaves. */
  panelOut(duration: number): void;
  setTheme(themeId: string): void;
  /** Counters (year, age) and the portrait move to the target step. */
  counters(duration: number): void;
  portrait(duration: number): void;
  /** New content appears (the panel renders the target step). */
  contentIn(stagger: number): void;
}

export const cameraOf = (s: Pick<ShellStep, "center" | "zoom">): CameraView => ({ center: s.center, zoom: s.zoom });

/**
 * Runs a planned transition. Each part starts at its time; when `signal`
 * aborts, parts not started yet run at once with zero duration and running
 * map animations jump to their end, so the scene is always left complete.
 * Resolves when every part has finished.
 */
export function runTransition(plan: TransitionPlan, to: ShellStep, actors: TransitionActors, signal: AbortSignal): Promise<void> {
  type Part = { at: number; run: (instant: boolean) => void | Promise<void> };
  const parts: Part[] = [
    { at: 0, run: (i) => actors.panelOut(i ? 0 : plan.panelOut) },
    { at: 0, run: () => actors.map.showStep(to.index) },
    { at: plan.themeAt, run: () => actors.setTheme(to.themeId) },
    { at: plan.camera.at, run: (i) => actors.map.flyTo(cameraOf(to), i ? 0 : plan.camera.duration, signal) },
    { at: plan.counters.at, run: (i) => actors.counters(i ? 0 : plan.counters.duration) },
    { at: plan.portrait.at, run: (i) => actors.portrait(i ? 0 : plan.portrait.duration) },
    { at: plan.contentAt, run: (i) => actors.contentIn(i ? 0 : plan.stagger) },
  ];
  if (plan.route) {
    const route = plan.route;
    parts.push({ at: route.at, run: (i) => actors.map.drawRoute(to.index, i ? 0 : route.duration, signal) });
  }

  return new Promise<void>((resolve) => {
    const pending = new Set(parts);
    const running: Promise<void>[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = (part: Part, instant: boolean) => {
      if (!pending.delete(part)) return;
      running.push(Promise.resolve(part.run(instant)).then(() => undefined));
      if (pending.size === 0) void Promise.all(running).then(() => resolve());
    };
    const abort = () => {
      timers.forEach(clearTimeout);
      [...pending].sort((a, b) => a.at - b.at).forEach((p) => start(p, true));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    for (const part of [...parts].sort((a, b) => a.at - b.at)) {
      if (part.at <= 0) start(part, false);
      else timers.push(setTimeout(() => start(part, false), part.at));
    }
  });
}
