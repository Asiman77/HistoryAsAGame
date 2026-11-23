"use client";

import { useEffect } from "react";
import { create } from "zustand";

/**
 * Period theme of the current view. A layout gives the default; a page or a
 * simulation step overrides it, and ThemeRoot crossfades to it.
 */
interface ThemeState {
  override: string | null;
  setOverride: (themeId: string | null) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
}));

/** Wears `themeId` while the calling component is mounted. */
export function usePeriodTheme(themeId: string | null | undefined) {
  const setOverride = useThemeStore((s) => s.setOverride);
  useEffect(() => {
    setOverride(themeId ?? null);
    return () => setOverride(null);
  }, [themeId, setOverride]);
}
