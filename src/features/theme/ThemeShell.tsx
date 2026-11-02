"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from "react";
import type { Mood, Theme } from "@/domain/schema";
import { deviceLooksWeak, useSettings } from "@/lib/settings";
import { cssText, themeVars } from "@/lib/theme";
import { Atmosphere } from "./Atmosphere";

interface ThemeState {
  theme: Theme;
  mood: Mood | null;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Current period theme, or null outside a ThemeShell. */
export function useTheme(): ThemeState | null {
  return useContext(ThemeContext);
}

const noop = () => () => {};
const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Effects off: light mode (set or detected) or the system asks for reduced motion. */
export function useCalmVisuals(): { light: boolean; calm: boolean } {
  const settings = useSettings();
  const weak = useSyncExternalStore(noop, deviceLooksWeak, () => false);
  // Hydration-safe: the static HTML is rendered as "motion allowed", the client corrects it after hydration.
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);
  const light = settings.lightMode ?? weak;
  return { light, calm: light || reduced };
}

/**
 * Puts a page into a period: sets the theme colours and fonts on <html> (so a
 * change between pages crossfades, see globals.css) and draws the layered
 * background. `variant="page"` draws art, texture, ambient and frame behind the
 * content; `variant="overlay"` only adds ambient and a thin frame over a map.
 */
export function ThemeShell({
  theme,
  mood = null,
  variant = "page",
  children,
}: {
  theme: Theme;
  mood?: Mood | null;
  variant?: "page" | "overlay" | "none";
  children?: React.ReactNode;
}) {
  const vars = themeVars(theme, mood);
  const key = JSON.stringify(vars);

  // Client navigation: set the variables on <html> so they transition.
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string>)) root.style.setProperty(k, v);
    root.setAttribute("data-theme", theme.id);
  }, [key, theme.id]);

  return (
    <ThemeContext.Provider value={{ theme, mood }}>
      {/* First paint of the static HTML, before hydration. Inline vars on <html> win afterwards. */}
      <style>{cssText(":root", vars)}</style>
      {variant !== "none" && <Atmosphere theme={theme} variant={variant} />}
      {children}
    </ThemeContext.Provider>
  );
}
