"use client";

import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/lib/cx";

/** Stamp inks take turns, like the design's gold, red and turquoise stamps. */
const INKS = ["border-accent text-accent", "border-negative text-negative", "border-claim-fact text-claim-fact", "border-claim-legend text-claim-legend"];

/** Deterministic tilt from the id: the same stamp always sits the same way. */
export function stampTilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 17) - 8) * 1;
}

export interface StampProps {
  id: string;
  name: string;
  index: number;
  /** Plays the stamping animation (a new stamp); otherwise it is simply there. */
  fresh: boolean;
  delayMs?: number;
  size?: "md" | "lg";
}

/** One passport stamp: a dashed ring with the place name, slammed in when new. */
export function Stamp({ id, name, index, fresh, delayMs = 0, size = "md" }: StampProps) {
  const reduced = useReducedMotion();
  const tilt = stampTilt(id);
  const animate = fresh && !reduced;
  return (
    <motion.span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full border-2 border-dashed text-center font-semibold leading-tight",
        size === "md" ? "size-16 p-1 text-12" : "size-24 p-2 text-14",
        INKS[index % INKS.length],
      )}
      initial={animate ? { scale: 1.9, opacity: 0, rotate: tilt - 14 } : false}
      animate={{ scale: 1, opacity: 1, rotate: tilt }}
      style={animate ? undefined : { rotate: `${tilt}deg` }}
      transition={{ delay: delayMs / 1000, type: "spring", stiffness: 420, damping: 18 }}
      data-testid="stamp"
      data-stamp={id}
      data-fresh={fresh}
    >
      {name}
    </motion.span>
  );
}
