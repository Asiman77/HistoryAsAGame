"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * True when motion should stop: the visitor prefers reduced motion, or light
 * mode is on (a `.lite` class on <html> or on an ancestor such as the design
 * root). Parallax, particles and twinkling read this; CSS animations follow
 * the same two switches in design-system.css. Still on the server and in the
 * first paint, so nothing starts moving before the preference is known.
 */
export function useStillness(ref: RefObject<Element | null>, force?: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(REDUCED);
      media.addEventListener("change", onChange);
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      const root = ref.current?.closest(".ds-root");
      if (root) observer.observe(root, { attributes: true, attributeFilter: ["class"] });
      return () => {
        media.removeEventListener("change", onChange);
        observer.disconnect();
      };
    },
    [ref],
  );
  const snapshot = () => window.matchMedia(REDUCED).matches || Boolean(ref.current?.closest(".lite"));
  const detected = useSyncExternalStore(subscribe, snapshot, () => true);
  return force ?? detected;
}
