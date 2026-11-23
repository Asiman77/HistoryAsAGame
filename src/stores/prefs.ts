"use client";

import { useStore } from "zustand";
import { createStore } from "@/lib/store";

import { isGrade, type Grade } from "@/lib/grades";

export { GRADES, isGrade, type Grade } from "@/lib/grades";

/** Viewer choices of the new design that are not settings (sound, light mode live in tarix:settings). */
export interface Prefs {
  /** Last grade opened in "Dərsliklə öyrən"; /kurikulum/ opens it again. */
  lastGrade: Grade | null;
}

const DEFAULT_PREFS: Prefs = { lastGrade: null };

export const prefs = createStore<Prefs>("tarix:prefs", DEFAULT_PREFS, (raw) => {
  const r = (raw ?? {}) as Partial<Prefs>;
  return { lastGrade: isGrade(r.lastGrade) ? r.lastGrade : null };
});

export function usePrefs<S>(selector: (p: Prefs) => S): S {
  return useStore(prefs.store, (s) => selector(s.value));
}

export function setLastGrade(grade: Grade) {
  prefs.set((p) => ({ ...p, lastGrade: grade }));
}
