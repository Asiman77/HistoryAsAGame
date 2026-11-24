"use client";

import dynamic from "next/dynamic";
import { useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from "react";
import type { Locale } from "@/domain/schema";
import type { CameraView, MapController, ShellData } from "../types";
import { SvgMap, type MapPadding } from "./SvgMap";

/** MapLibre and its worker load only here, on simulation routes (§11). */
const MapLibreMap = dynamic(() => import("@/features/map-gl/MapLibreMap").then((m) => m.MapLibreMap), { ssr: false });

const noop = () => () => {};

let glSupport: boolean | null = null;

/**
 * WebGL is there (MapLibre needs it); unknown on the server. Checked once per
 * page and the probe context is released at once: useSyncExternalStore asks
 * on every render, and each new context counts against the browser's limit
 * (about 16), after which it drops the oldest one, the map's.
 */
function webglAvailable(): boolean {
  if (glSupport !== null) return glSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    glSupport = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    glSupport = false;
  }
  return glSupport;
}

interface Props {
  data: ShellData;
  locale: Locale;
  padding: MapPadding;
  lite: boolean;
  reduced: boolean;
  /** City card from a marker click (MapLibre only; the panel's place name works everywhere). */
  onPlace: (placeId: string) => void;
  ref?: Ref<MapController>;
}

/**
 * The map of the shell: MapLibre when WebGL works, otherwise the SVG map
 * (§7: the simulation goes on without WebGL). It remembers what the
 * choreography asked for and replays it when a map becomes ready, so steps
 * shown before MapLibre has loaded (or before a fallback) are not lost.
 */
export function ShellMap({ data, locale, padding, lite, reduced, onPlace, ref }: Props) {
  const gl = useSyncExternalStore(noop, webglAvailable, () => null);
  const [failed, setFailed] = useState(false);
  const renderer = gl === null ? null : gl && !failed ? "gl" : "svg";
  const inner = useRef<MapController>(null);
  const ready = useRef(false);
  const last = useRef<{ index: number | null; camera: CameraView | null; drawn: number | null }>({ index: null, camera: null, drawn: null });

  const replay = () => {
    const c = inner.current;
    if (!c) return;
    ready.current = true;
    const { index, camera, drawn } = last.current;
    const signal = new AbortController().signal;
    if (index !== null) c.showStep(index);
    if (camera) void c.flyTo(camera, 0, signal);
    if (drawn !== null && drawn === index) void c.drawRoute(drawn, 0, signal);
  };

  useImperativeHandle(
    ref,
    (): MapController => ({
      showStep(i) {
        last.current = { ...last.current, index: i, drawn: null };
        if (ready.current) inner.current?.showStep(i);
      },
      flyTo(view, duration, signal) {
        last.current.camera = view;
        return ready.current && inner.current ? inner.current.flyTo(view, duration, signal) : Promise.resolve();
      },
      drawRoute(i, duration, signal) {
        last.current.drawn = i;
        return ready.current && inner.current ? inner.current.drawRoute(i, duration, signal) : Promise.resolve();
      },
    }),
    [],
  );

  return (
    <div className="absolute inset-0" data-testid="map" data-renderer={renderer ?? "pending"}>
      {renderer === "gl" ? (
        <>
          <MapLibreMap
            ref={inner}
            data={data}
            locale={locale}
            padding={padding}
            lite={lite}
            reduced={reduced}
            onReady={replay}
            onPlace={onPlace}
            onFail={() => {
              ready.current = false;
              setFailed(true);
            }}
          />
          {/* Grain and vignette as a DOM layer, independent of WebGL (§7). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 75% at 45% 45%, transparent 55%, color-mix(in srgb, var(--map-parchment-edge) 55%, transparent) 100%)" }}
          />
          <div aria-hidden className="ds-grain pointer-events-none absolute inset-0 opacity-40" />
        </>
      ) : renderer === "svg" ? (
        <SvgMap ref={inner} steps={data.steps} places={data.places} land={data.land} padding={padding} onReady={replay} />
      ) : null}
    </div>
  );
}
