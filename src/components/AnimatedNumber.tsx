"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Counts from the currently shown value to the new one. Frames are written to
 * the DOM directly, so React only ever renders the constant initial text:
 * letting React diff a text node we replaced would make it touch a detached node.
 */
export function AnimatedNumber({ value, prefix = "", className = "" }: { value: number; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const [initial] = useState(() => `${prefix}${value}`);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const write = (v: number) => {
      shown.current = v;
      el.textContent = `${prefix}${Math.round(v)}`;
    };
    if (reduced || shown.current === value) {
      write(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration: Math.min(0.6 + Math.abs(value - shown.current) * 0.02, 1.6),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: write,
    });
    return () => controls.stop();
  }, [value, prefix, reduced]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {initial}
    </span>
  );
}
