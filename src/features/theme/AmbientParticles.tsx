"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
}

const STYLE = {
  // Dust motes in a sunbeam: slow, warm, barely visible.
  dust: { color: "255 236 190", alpha: 0.35, speed: 0.12, size: [0.8, 2.2] },
  // Camp-fire embers: rising, orange, flickering.
  embers: { color: "255 150 70", alpha: 0.45, speed: 0.35, size: [0.8, 1.8] },
} as const;

/**
 * A few dozen particles on a 1x canvas. Pauses when the tab is hidden; the
 * caller only mounts it when effects are allowed (not light mode, not reduced motion).
 */
export function AmbientParticles({ kind, count }: { kind: keyof typeof STYLE; count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const s = STYLE[kind];
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = canvas.clientWidth;
      h = canvas.height = canvas.clientHeight;
    };
    resize();
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const spawn = (anywhere: boolean): Particle => ({
      x: rand(0, w),
      y: anywhere ? rand(0, h) : h + 5,
      r: rand(s.size[0], s.size[1]),
      vx: rand(-0.15, 0.15),
      vy: -rand(0.3, 1) * s.speed,
      phase: rand(0, Math.PI * 2),
    });
    const ps = Array.from({ length: count }, () => spawn(true));

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last) / 16.7;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]!;
        p.phase += 0.02 * dt;
        p.x += (p.vx + Math.sin(p.phase) * 0.12) * dt;
        p.y += p.vy * dt;
        if (p.y < -5 || p.x < -5 || p.x > w + 5) ps[i] = spawn(false);
        const flicker = kind === "embers" ? 0.55 + 0.45 * Math.sin(p.phase * 3) : 0.7 + 0.3 * Math.sin(p.phase);
        ctx.fillStyle = `rgb(${s.color} / ${(s.alpha * flicker).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
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
  }, [kind, count]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" data-testid="ambient-particles" />;
}
