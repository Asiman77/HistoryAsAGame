import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMERA_AT_MS,
  CAMERA_MAX_MS,
  CAMERA_MIN_MS,
  PANEL_OUT_MS,
  ROUTE_MAX_MS,
  ROUTE_MIN_MS,
  haversineKm,
  planTransition,
  runTransition,
  type TransitionActors,
} from "@/features/simulation-shell/choreography";
import { behaviourOf, deriveTemplate } from "@/features/simulation-shell/templates";
import type { CameraView, LngLat, MapController, ShellStep } from "@/features/simulation-shell/types";

/** Sample geometry, not historical content. */
function step(index: number, center: LngLat, extra: Partial<ShellStep> = {}): ShellStep {
  return {
    id: `s${index}`,
    index,
    year: 1500 + index,
    dateLabel: String(1500 + index),
    title: `Addım ${index}`,
    kind: "Nümunə",
    nodeLabel: `N${index}`,
    template: "location",
    mood: "journey",
    themeId: "default",
    claimType: "fact",
    center,
    zoom: 6,
    placeName: "Nümunə",
    placeId: null,
    stampId: null,
    from: null,
    modernName: null,
    approximatePlace: false,
    route: null,
    distanceKm: 0,
    snapshotId: null,
    mapVariant: "manuscript",
    narrative: null,
    summary: "",
    sources: [],
    related: [],
    choice: null,
    battle: null,
    claims: [],
    more: { date: null, primary: null, terms: [], world: [] },
    musicThemeId: null,
    age: null,
    portrait: null,
    ...extra,
  };
}

const A: LngLat = [48.29, 38.25];
const B: LngLat = [46.29, 38.08]; // ≈ 175 km west
const FAR: LngLat = [59.6, 36.3]; // ≈ 1000 km east

describe("templates", () => {
  it("derives the template from the step", () => {
    expect(deriveTemplate({})).toBe("location");
    expect(deriveTemplate({ hasRoute: true })).toBe("journey");
    expect(deriveTemplate({ hasRoute: true, battle: true })).toBe("battle");
    expect(deriveTemplate({ stateStage: true })).toBe("territory");
    expect(deriveTemplate({ warDay: true, hasRoute: true })).toBe("liberation");
  });
  it("lets data choose, when it names a known template", () => {
    expect(deriveTemplate({ template: "monument", hasRoute: true })).toBe("monument");
    expect(deriveTemplate({ template: "unknown", hasRoute: true })).toBe("journey");
  });
  it("plays unbuilt templates as a place for now", () => {
    expect(behaviourOf("journey")).toBe("journey");
    expect(behaviourOf("battle")).toBe("location");
    expect(behaviourOf("treaty")).toBe("location");
  });
});

describe("planTransition (§5.3)", () => {
  it("measures distances on the sphere", () => {
    expect(haversineKm(A, B)).toBeGreaterThan(160);
    expect(haversineKm(A, B)).toBeLessThan(190);
  });

  it("follows the spec's order and ranges", () => {
    const p = planTransition(step(0, A), step(1, B), { reduced: false });
    expect(p.panelOut).toBe(PANEL_OUT_MS);
    expect(p.themeAt).toBe(100);
    expect(p.camera.at).toBe(CAMERA_AT_MS);
    expect(p.camera.duration).toBeGreaterThanOrEqual(CAMERA_MIN_MS);
    expect(p.camera.duration).toBeLessThanOrEqual(CAMERA_MAX_MS);
    expect(p.contentAt).toBeGreaterThan(p.panelOut);
    expect(p.readableAt).toBeGreaterThanOrEqual(900);
    expect(p.readableAt).toBeLessThanOrEqual(2400);
  });

  it("flies longer for longer distances, within 900–1800 ms", () => {
    const near = planTransition(step(0, A), step(1, B), { reduced: false });
    const far = planTransition(step(0, A), step(1, FAR), { reduced: false });
    expect(far.camera.duration).toBeGreaterThan(near.camera.duration);
    expect(far.camera.duration).toBe(CAMERA_MAX_MS);
    expect(far.readableAt).toBeLessThanOrEqual(2400);
  });

  it("draws a route when the camera arrives, in 1200–2000 ms", () => {
    const to = step(1, B, { template: "journey", route: [A, B], distanceKm: 180 });
    const p = planTransition(step(0, A), to, { reduced: false });
    expect(p.route).not.toBeNull();
    expect(p.route!.at).toBe(p.camera.at + p.camera.duration);
    expect(p.route!.duration).toBeGreaterThanOrEqual(ROUTE_MIN_MS);
    expect(p.route!.duration).toBeLessThanOrEqual(ROUTE_MAX_MS);
    expect(p.doneAt).toBe(p.route!.at + p.route!.duration);
    // The text does not wait for the route.
    expect(p.readableAt).toBeLessThan(p.doneAt);
  });

  it("keeps the camera still at the same place", () => {
    const p = planTransition(step(0, A), step(1, A), { reduced: false });
    expect(p.camera.duration).toBe(0);
    expect(p.contentAt).toBe(PANEL_OUT_MS + 50);
  });

  it("jumps with reduced motion and on the first paint", () => {
    const reduced = planTransition(step(0, A), step(1, FAR, { route: [A, FAR] }), { reduced: true });
    expect(reduced.camera.duration).toBe(0);
    expect(reduced.route).toEqual({ at: 0, duration: 0 });
    expect(reduced.contentAt).toBe(0);
    expect(planTransition(null, step(0, A), { reduced: false }).doneAt).toBe(0);
  });
});

describe("runTransition", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function actors() {
    const log: string[] = [];
    const map: MapController = {
      showStep: (i) => void log.push(`show:${i}`),
      flyTo: (v: CameraView, d, signal) =>
        new Promise<void>((resolve) => {
          log.push(`fly:${v.center.join(",")}:${d}`);
          if (d === 0) return resolve();
          const t = setTimeout(resolve, d);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            log.push("fly:jump");
            resolve();
          });
        }),
      drawRoute: (i, d, signal) =>
        new Promise<void>((resolve) => {
          log.push(`route:${i}:${d}`);
          if (d === 0) return resolve();
          const t = setTimeout(resolve, d);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            log.push("route:complete");
            resolve();
          });
        }),
    };
    const a: TransitionActors = {
      map,
      panelOut: (d) => void log.push(`out:${d}`),
      setTheme: (t) => void log.push(`theme:${t}`),
      counters: (d) => void log.push(`counters:${d}`),
      portrait: (d) => void log.push(`portrait:${d}`),
      contentIn: (s) => void log.push(`in:${s}`),
    };
    return { log, a };
  }

  it("plays the parts at their times and resolves when all are done", async () => {
    const { log, a } = actors();
    const to = step(1, B, { template: "journey", route: [A, B], distanceKm: 180, themeId: "sefevi" });
    const plan = planTransition(step(0, A), to, { reduced: false });
    let done = false;
    void runTransition(plan, to, a, new AbortController().signal).then(() => (done = true));
    expect(log).toEqual(["out:200", "show:1"]);
    await vi.advanceTimersByTimeAsync(100);
    expect(log).toContain("theme:sefevi");
    await vi.advanceTimersByTimeAsync(50);
    expect(log).toContain(`fly:${B.join(",")}:${plan.camera.duration}`);
    expect(log).toContain("counters:600");
    expect(log.some((l) => l.startsWith("route:"))).toBe(false);
    await vi.advanceTimersByTimeAsync(plan.camera.duration);
    expect(log).toContain(`route:1:${plan.route!.duration}`);
    expect(log).toContain("in:40");
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(plan.route!.duration);
    expect(done).toBe(true);
  });

  it("skips: an abort finishes running moves and starts the rest at once", async () => {
    const { log, a } = actors();
    const to = step(1, FAR, { template: "journey", route: [A, FAR], distanceKm: 1000 });
    const plan = planTransition(step(0, A), to, { reduced: false });
    const ctrl = new AbortController();
    let done = false;
    void runTransition(plan, to, a, ctrl.signal).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(300); // camera in flight
    ctrl.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toContain("fly:jump");
    expect(log).toContain("route:1:0");
    expect(log).toContain("in:0");
    expect(done).toBe(true);
  });
});
