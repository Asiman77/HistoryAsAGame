"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { CameraView, MapController, ShellPlace, ShellStep } from "../types";
import { linePath, project, spanAtZoom } from "./projection";

/** cubic-bezier(.65,0,.35,1), the spec's camera easing (§5.3). */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export interface MapPadding {
  right: number;
  bottom: number;
}

interface View {
  cx: number;
  cy: number;
  /** Width of the visible map in map units. */
  span: number;
}

interface Props {
  steps: ShellStep[];
  places: ShellPlace[];
  land: string;
  /** Screen space covered by the story panel; the target is centred in the rest. */
  padding: MapPadding;
  ref?: Ref<MapController>;
}

const toView = (v: CameraView, widthPx: number): View => {
  const [cx, cy] = project(v.center);
  return { cx, cy, span: spanAtZoom(v.zoom, Math.max(widthPx, 320)) };
};

/**
 * Schematic parchment map in SVG: land outline, places revealed as the story
 * reaches them, faded trails of past routes, the current route drawn with a
 * rider, a pulsing marker. It implements MapController, so it stands in for
 * MapLibre now (phase 3) and stays as the no-WebGL fallback (§7).
 * Camera and route frames are written to the DOM directly, not through React.
 */
export function SvgMap({ steps, places, land, padding, ref }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const routeEl = useRef<SVGPathElement>(null);
  const rider = useRef<SVGGElement>(null);
  const view = useRef<View>({ cx: 0, cy: 0, span: 10 });
  const size = useRef({ w: 1, h: 1 });
  const pad = useRef(padding);
  const progress = useRef({ index: -1, p: 0 });
  const [index, setIndex] = useState(-1);

  const apply = () => {
    const el = svg.current;
    if (!el) return;
    const { w, h } = size.current;
    const { cx, cy, span } = view.current;
    const upp = span / w; // map units per CSS pixel
    const height = span * (h / w);
    // Shift so the target sits in the middle of the area the panel leaves free.
    const x = cx - span / 2 + (pad.current.right / 2) * upp;
    const y = cy - height / 2 + (pad.current.bottom / 2) * upp;
    el.setAttribute("viewBox", `${x} ${y} ${span} ${height}`);
    el.style.setProperty("--inv", String(upp));
  };

  const placeRider = (p: number) => {
    const path = routeEl.current;
    const r = rider.current;
    if (!path || !r) return;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * p);
    r.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    r.style.opacity = p > 0 && p < 1 ? "1" : "0";
  };

  const paintRoute = () => {
    const path = routeEl.current;
    if (!path) return;
    const p = progress.current.index === index ? progress.current.p : 0;
    path.style.strokeDashoffset = String(1 - p);
    placeRider(p);
  };

  useEffect(() => {
    pad.current = padding;
    apply();
  }, [padding]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      size.current = { w: Math.max(1, entry.contentRect.width), h: Math.max(1, entry.contentRect.height) };
      apply();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // After a step change renders the new route element, paint its current progress.
  useEffect(paintRoute, [index]);

  useImperativeHandle(
    ref,
    (): MapController => ({
      showStep(i) {
        progress.current = { index: i, p: 0 };
        setIndex(i);
      },
      flyTo(target, duration, signal) {
        const to = toView(target, size.current.w);
        if (duration <= 0 || signal.aborted) {
          view.current = to;
          apply();
          return Promise.resolve();
        }
        const from = { ...view.current };
        const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
        // MapLibre-like curve: zoom out on the way when the jump is long.
        const peak = Math.max(from.span, to.span, dist * 1.4);
        return new Promise<void>((resolve) => {
          const t0 = performance.now();
          let raf = 0;
          const end = () => {
            cancelAnimationFrame(raf);
            view.current = to;
            apply();
            resolve();
          };
          const frame = (now: number) => {
            const t = Math.min(1, (now - t0) / duration);
            const e = easeInOutCubic(t);
            const base = from.span + (to.span - from.span) * e;
            view.current = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, span: base + (peak - base) * Math.sin(Math.PI * e) * 0.6 };
            apply();
            if (t < 1) raf = requestAnimationFrame(frame);
            else end();
          };
          signal.addEventListener("abort", end, { once: true });
          raf = requestAnimationFrame(frame);
        });
      },
      drawRoute(i, duration, signal) {
        if (duration <= 0 || signal.aborted) {
          progress.current = { index: i, p: 1 };
          paintRoute();
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const t0 = performance.now();
          let raf = 0;
          const end = () => {
            cancelAnimationFrame(raf);
            progress.current = { index: i, p: 1 };
            paintRoute();
            resolve();
          };
          const frame = (now: number) => {
            const t = Math.min(1, (now - t0) / duration);
            progress.current = { index: i, p: easeInOutCubic(t) };
            paintRoute();
            if (t < 1) raf = requestAnimationFrame(frame);
            else end();
          };
          signal.addEventListener("abort", end, { once: true });
          raf = requestAnimationFrame(frame);
        });
      },
    }),
    [index], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const current = steps[index];
  const shown = places.filter((p) => p.firstStep <= index);
  const trails = steps.filter((s) => s.index < index && s.route && s.route.length > 1);
  const [mx, my] = current ? project(current.center) : [0, 0];

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-map-water" data-testid="svg-map" data-step={index}>
      <svg ref={svg} className="block h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
        <path d={land} fillRule="evenodd" className="fill-map-parchment-center stroke-map-ink/40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <g className="fill-none stroke-map-ink/45" strokeWidth={1.6} strokeDasharray="2 6" vectorEffect="non-scaling-stroke">
          {trails.map((s) => (
            <path key={s.id} d={linePath(s.route!)} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          ))}
        </g>
        {current?.route && current.route.length > 1 ? (
          <path
            key={current.id}
            ref={routeEl}
            d={linePath(current.route)}
            pathLength={1}
            strokeDasharray="1 1"
            className="fill-none stroke-secondary"
            strokeLinecap="round"
            // Width in map units (3.5 px at any zoom): non-scaling strokes would put the dashes in screen
            // space, where pathLength does not apply, and break the progressive drawing.
            style={{ strokeDashoffset: 1, strokeWidth: "calc(3.5 * var(--inv))" }}
          />
        ) : null}
        <g>
          {shown.map((p) => {
            const [x, y] = project(p.center);
            const here = current && Math.abs(p.center[0] - current.center[0]) < 1e-3 && Math.abs(p.center[1] - current.center[1]) < 1e-3;
            if (here) return null;
            return (
              <g key={p.key} transform={`translate(${x} ${y})`}>
                <g style={{ transform: "scale(var(--inv))" }}>
                  <circle r={4.5} className="fill-map-ink" />
                  <text x={9} y={5} className="fill-map-ink font-heading" fontSize={15} paintOrder="stroke" stroke="var(--map-parchment-center)" strokeWidth={3}>
                    {p.name}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        {current ? (
          <g transform={`translate(${mx} ${my})`} data-testid="map-current">
            <g style={{ transform: "scale(var(--inv))" }}>
              <circle r={22} className="ds-animate-pulse fill-none stroke-secondary" strokeWidth={1.5} />
              <circle r={11} className="fill-map-parchment-center" />
              <circle r={7.5} className="fill-secondary" />
              <text x={18} y={9} className="fill-map-ink font-heading" fontSize={26} fontWeight={500} paintOrder="stroke" stroke="var(--map-parchment-center)" strokeWidth={4}>
                {current.placeName.replace(/\s*\(.*\)\s*$/, "")}
              </text>
            </g>
          </g>
        ) : null}
        <g ref={rider} style={{ opacity: 0 }}>
          <g style={{ transform: "scale(var(--inv))" }}>
            <circle r={6} className="fill-accent stroke-map-ink" strokeWidth={1.5} />
          </g>
        </g>
      </svg>
      {/* Parchment light and vignette as a DOM layer (§7), independent of the map renderer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 45% 45%, transparent 35%, color-mix(in srgb, var(--map-parchment-mid) 35%, transparent) 65%, color-mix(in srgb, var(--map-parchment-edge) 80%, transparent) 100%)",
          mixBlendMode: "multiply",
        }}
      />
      <div aria-hidden className="ds-grain pointer-events-none absolute inset-0 opacity-50" />
    </div>
  );
}
