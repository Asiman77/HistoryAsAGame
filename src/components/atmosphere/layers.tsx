"use client";

import { useEffect, useId, useRef } from "react";

/*
 * The five layers of AtmosphereBackground (§3.5), bottom to top. Colours come
 * only from theme tokens, so each layer follows the period and crossfades with it.
 */

export type GlowTone = "accent" | "secondary" | "dawn";

export interface GlowProps {
  /** Centre of the light, CSS position. */
  x?: string;
  y?: string;
  /** 0..1, share of the colour at the centre. */
  strength?: number;
  tone?: GlowTone;
}

const toneVar: Record<GlowTone, string> = { accent: "var(--accent)", secondary: "var(--secondary)", dawn: "var(--dawn-glow)" };

/** Layer 1: theme ground plus a soft radial light. `sky` paints night → dawn instead (war intro). */
export function Ground({ glow, sky }: { glow: GlowProps | false; sky: boolean }) {
  const light = glow
    ? `radial-gradient(ellipse 60% 55% at ${glow.x ?? "70%"} ${glow.y ?? "18%"}, color-mix(in srgb, ${toneVar[glow.tone ?? "accent"]} ${Math.round((glow.strength ?? 0.22) * 100)}%, transparent), transparent 70%)`
    : null;
  const base = sky
    ? "linear-gradient(180deg, var(--sky-night) 0%, var(--sky-dusk) 55%, var(--sky-horizon) 100%)"
    : "linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-base) 72%)";
  return <div className="absolute inset-0" style={{ background: [light, base].filter(Boolean).join(", ") }} />;
}

/** Layer 2: girih (eight-pointed star) pattern fading toward the edges. */
export function GirihPattern({ opacity }: { opacity: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="absolute inset-0 h-full w-full text-accent" style={{ opacity }} aria-hidden focusable="false">
      <defs>
        <pattern id={`girih-${id}`} width="96" height="96" patternUnits="userSpaceOnUse">
          <polygon
            points="48,10 57,33 82,24 69,46 86,62 62,63 58,88 48,66 38,88 34,63 10,62 27,46 14,24 39,33"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle cx="48" cy="48" r="9" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M0 0 L14 14 M96 0 L82 14 M0 96 L14 82 M96 96 L82 82" stroke="currentColor" strokeWidth="1" />
        </pattern>
        <radialGradient id={`girih-fade-${id}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`girih-mask-${id}`}>
          <rect width="100%" height="100%" fill={`url(#girih-fade-${id})`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#girih-${id})`} mask={`url(#girih-mask-${id})`} />
    </svg>
  );
}

export type SilhouetteKind = "mountains" | "city" | "cliffs";

/** Fill mixed from the background toward a theme colour. */
const tint = (toward: string, share: number) => `color-mix(in srgb, var(--bg-base) ${100 - share}%, ${toward})`;

function Mountains() {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="h-full w-full" aria-hidden focusable="false">
      <path data-depth="3" d="M0 210 L120 150 L210 185 L330 110 L450 175 L560 120 L690 190 L800 130 L930 180 L1060 100 L1180 170 L1300 125 L1440 170 L1440 320 L0 320 Z" fill={tint("var(--secondary)", 28)} opacity="0.9" />
      <path data-depth="2" d="M0 250 L140 205 L260 240 L400 190 L520 235 L660 200 L790 245 L930 205 L1080 248 L1220 210 L1340 240 L1440 220 L1440 320 L0 320 Z" fill={tint("var(--secondary)", 17)} />
      <path data-depth="1" d="M0 290 L180 262 L360 285 L540 258 L720 288 L900 262 L1080 286 L1260 264 L1440 284 L1440 320 L0 320 Z" fill="var(--bg-base)" />
    </svg>
  );
}

function CitySkyline() {
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" className="h-full w-full" style={{ opacity: 0.55 }} aria-hidden focusable="false">
      <path data-depth="2" d="M0 360 L0 250 L120 250 L120 200 L160 160 L200 200 L200 250 L340 250 L340 170 C340 120, 420 90, 460 90 C500 90, 580 120, 580 170 L580 250 L620 250 L620 120 L640 100 L660 120 L660 250 L820 250 L820 210 L900 210 L900 140 C900 110, 960 90, 990 90 C1020 90, 1080 110, 1080 140 L1080 250 L1240 250 L1240 190 L1280 160 L1320 190 L1320 250 L1440 250 L1440 360 Z" fill={tint("var(--secondary)", 28)} />
      <path data-depth="1" d="M380 250 L380 190 Q460 140 540 190 L540 250" fill="none" stroke="var(--secondary-2)" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}

/** Şuşa cliffs with the fortress towers on the ridge (war intro). */
function Cliffs() {
  return (
    <svg viewBox="0 0 1440 300" preserveAspectRatio="none" className="h-full w-full" aria-hidden focusable="false">
      <g data-depth="2" fill={tint("var(--text-muted)", 7)} stroke={tint("var(--text-muted)", 7)}>
        <path d="M0 180 L160 150 L300 170 L420 120 L520 135 L600 70 L700 60 L760 90 L860 80 L960 130 L1100 110 L1240 150 L1440 130 L1440 300 L0 300 Z" stroke="none" />
        <path d="M600 70 L612 48 L622 70 M680 60 L690 34 L700 60 M640 66 L646 50 L652 66" fill="none" strokeWidth="6" />
      </g>
      <path data-depth="1" d="M0 240 L200 215 L420 236 L640 205 L860 232 L1080 210 L1300 232 L1440 220 L1440 300 L0 300 Z" fill={tint("var(--text-muted)", 2)} />
    </svg>
  );
}

const SILHOUETTES: Record<SilhouetteKind, () => React.JSX.Element> = { mountains: Mountains, city: CitySkyline, cliffs: Cliffs };
const HEIGHT: Record<SilhouetteKind, string> = { mountains: "clamp(160px, 22vw, 300px)", city: "clamp(180px, 25vw, 360px)", cliffs: "clamp(160px, 21vw, 300px)" };

/**
 * Layer 3: silhouette of the period. Each path with `data-depth` moves 2–6 px
 * with the pointer (parallax), unless motion is stilled.
 */
export function Silhouette({ kind, parallax }: { kind: SilhouetteKind; parallax: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !parallax) return;
    const parts = [...el.querySelectorAll<SVGElement>("[data-depth]")];
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const dx = e.clientX / window.innerWidth - 0.5;
        const dy = e.clientY / window.innerHeight - 0.5;
        for (const p of parts) {
          const depth = Number(p.dataset.depth ?? 1);
          p.style.transform = `translate(${(dx * 2 * (depth + 1)).toFixed(2)}px, ${(dy * (depth + 1)).toFixed(2)}px)`;
        }
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      for (const p of parts) p.style.transform = "";
    };
  }, [parallax, kind]);
  const Shape = SILHOUETTES[kind];
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0" style={{ height: HEIGHT[kind] }} data-testid={`silhouette-${kind}`}>
      <Shape />
    </div>
  );
}

/** Star field of the war intro sky (positions from the design, in % of the box). */
const STARS: [number, number, number, number][] = [
  [8.3, 8.9, 1.2, 0.7], [18, 16.7, 1, 0.5], [29.2, 6.7, 1.4, 0.8], [42.4, 14.4, 1, 0.5], [61.1, 7.8, 1.3, 0.7],
  [72.2, 17.8, 1, 0.4], [84, 10, 1.5, 0.8], [93.8, 21.1, 1, 0.5], [52.8, 23.3, 0.9, 0.4], [22.9, 27.8, 0.9, 0.4],
];

/** Layer 4a: stars, twinkling unless motion is stilled. */
export function Stars({ still }: { still: boolean }) {
  return (
    <div className="absolute inset-0" aria-hidden data-testid="effect-stars">
      {STARS.map(([x, y, r, o], i) => (
        <span
          key={i}
          className={still ? "absolute rounded-full bg-fg" : "ds-animate-twinkle absolute rounded-full bg-fg"}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: r * 2,
            height: r * 2,
            opacity: o,
            ["--star-max" as string]: o,
            ["--star-min" as string]: o * 0.35,
            animationDelay: `${(i * 0.7) % 4.8}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Layer 4b: warm dawn rising from the horizon (8 Noyabr, war intro). */
export function Dawn() {
  return (
    <div
      className="absolute inset-0"
      aria-hidden
      data-testid="effect-dawn"
      style={{ background: "radial-gradient(ellipse 70% 60% at 50% 105%, color-mix(in srgb, var(--dawn-glow) 45%, transparent), transparent 60%)" }}
    />
  );
}

/** Layer 4c: slow dust motes in the accent colour, on a 1x canvas; paused when the tab is hidden. */
export function Dust({ count = 36 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const color = getComputedStyle(canvas).getPropertyValue("--accent").trim() || "white";
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = canvas.clientWidth;
      h = canvas.height = canvas.clientHeight;
    };
    resize();
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const spawn = (anywhere: boolean) => ({ x: rand(0, w), y: anywhere ? rand(0, h) : h + 4, r: rand(0.6, 1.8), vx: rand(-0.12, 0.12), vy: -rand(0.04, 0.14), phase: rand(0, 6.28) });
    const motes = Array.from({ length: count }, () => spawn(true));
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last) / 16.7;
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      motes.forEach((m, i) => {
        m.phase += 0.015 * dt;
        m.x += (m.vx + Math.sin(m.phase) * 0.1) * dt;
        m.y += m.vy * dt;
        if (m.y < -4 || m.x < -4 || m.x > w + 4) motes[i] = spawn(false);
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(m.phase);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden data-testid="effect-dust" />;
}

/** Layer 5: vignette and film grain. */
export function VignetteGrain({ vignette, grain }: { vignette: boolean; grain: boolean }) {
  return (
    <>
      {vignette ? (
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, color-mix(in srgb, var(--bg-base) 60%, black) 130%)" }} />
      ) : null}
      {grain ? <div className="ds-grain absolute inset-0 opacity-60" data-testid="grain" /> : null}
    </>
  );
}
