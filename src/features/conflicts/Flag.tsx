"use client";

import { motion, useReducedMotion } from "motion/react";
import { FLAG } from "./liberation";

/** Eight-pointed star as two overlapping squares, centred at (cx, cy). */
function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.55;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Azerbaijani flag (1:2): blue, red, green with a white crescent and eight-pointed star. */
export function AzFlag({ className = "", wave = false }: { className?: string; wave?: boolean }) {
  return (
    <svg viewBox="0 0 120 60" className={`${className} ${wave ? "flag-wave" : ""}`} role="img" aria-label="Azərbaycan bayrağı">
      <rect width="120" height="20" fill={FLAG.blue} />
      <rect y="20" width="120" height="20" fill={FLAG.red} />
      <rect y="40" width="120" height="20" fill={FLAG.green} />
      <circle cx="57" cy="30" r="7.5" fill="#fff" />
      <circle cx="59" cy="30" r="6.25" fill={FLAG.red} />
      <path d={starPath(64.5, 30, 3.75)} fill="#fff" />
    </svg>
  );
}

/**
 * Start-screen art of the war section: from darkness the three stripes sweep
 * in, the crescent and star appear, then the date.
 */
export function WarIntro({ date, heading }: { date: string; heading: string }) {
  const reduced = useReducedMotion();
  const stripe = (i: number) => ({
    initial: reduced ? false : ({ scaleX: 0 } as const),
    animate: { scaleX: 1 },
    transition: { duration: 0.9, delay: 0.2 + i * 0.25, ease: [0.22, 1, 0.36, 1] as const },
  });
  return (
    <div className="flex w-full flex-col items-center" data-testid="war-intro">
      <div className="relative w-full max-w-[18rem] overflow-hidden rounded-sm shadow-[0_0_60px_-10px_rgb(0_181_226/0.45)]">
        <svg viewBox="0 0 120 60" className="block w-full" aria-hidden>
          <motion.rect width="120" height="20" fill={FLAG.blue} style={{ originX: 0 }} {...stripe(0)} />
          <motion.rect y="20" width="120" height="20" fill={FLAG.red} style={{ originX: 1 }} {...stripe(1)} />
          <motion.rect y="40" width="120" height="20" fill={FLAG.green} style={{ originX: 0 }} {...stripe(2)} />
        </svg>
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          <AzFlag className="block h-full w-full [&>rect]:opacity-0" />
        </motion.div>
      </div>
      <motion.p
        className="mt-5 font-display text-3xl font-semibold tracking-wide text-white"
        initial={reduced ? false : { opacity: 0, y: 10, letterSpacing: "0.3em" }}
        animate={{ opacity: 1, y: 0, letterSpacing: "0.04em" }}
        transition={{ duration: 1.2, delay: 1.6 }}
      >
        {date}
      </motion.p>
      <motion.p
        className="mt-1 text-xs font-semibold tracking-[0.3em] uppercase"
        style={{ color: FLAG.blue }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2.2 }}
      >
        {heading}
      </motion.p>
    </div>
  );
}
