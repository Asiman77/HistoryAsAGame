"use client";

import { useEffect, useRef, type RefObject } from "react";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export interface ShellKeys {
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoplay: () => void;
  onEscape: () => void;
  onMute: () => void;
}

/**
 * Keyboard of the simulation (§5.4): ← → steps, Space autoplay, Esc panel,
 * M sound. Ignored while typing, with modifier keys, inside radio groups
 * (their arrows move the choice) and for Space on buttons and links (it
 * presses them natively).
 */
export function useShellKeys(keys: ShellKeys) {
  const ref = useRef(keys);
  useEffect(() => {
    ref.current = keys;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && target?.closest('[role="radiogroup"]')) return;
      const k = ref.current;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        k.onNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        k.onPrev();
      } else if (e.key === " " && !target?.closest("button, a, summary, [role='button']")) {
        e.preventDefault();
        k.onToggleAutoplay();
      } else if (e.key === "Escape") {
        k.onEscape();
      } else if (e.key === "m" || e.key === "M") {
        k.onMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Horizontal swipe on an element (mobile, §5.4): left = next, right = previous. */
export function useSwipe(target: RefObject<HTMLElement | null>, { onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const handlers = useRef({ onLeft, onRight });
  useEffect(() => {
    handlers.current = { onLeft, onRight };
  });
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const fast = performance.now() - start.t < 600;
      start = null;
      if (fast && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? handlers.current.onLeft : handlers.current.onRight)();
    };
    const cancel = () => (start = null);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [target]);
}

/**
 * Autoplay (§5.4, projector mode): when a step has finished its transition
 * (`readyKey` changes) and playing is on, wait `dwellMs`, then advance.
 */
export function useAutoplay(playing: boolean, readyKey: string | null, dwellMs: number, advance: () => void) {
  const next = useRef(advance);
  useEffect(() => {
    next.current = advance;
  });
  useEffect(() => {
    if (!playing || !readyKey) return;
    const t = setTimeout(() => next.current(), dwellMs);
    return () => clearTimeout(t);
  }, [playing, readyKey, dwellMs]);
}
