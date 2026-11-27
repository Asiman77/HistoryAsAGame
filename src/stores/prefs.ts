"use client";

import { useStore } from "zustand";
import { createStore } from "@/lib/store";

import { normalizeClassCode } from "@/lib/classCode";
import { isGrade, type Grade } from "@/lib/grades";

export { GRADES, isGrade, type Grade } from "@/lib/grades";

/** Viewer choices of the new design that are not settings (sound, light mode live in tarix:settings). */
export interface Prefs {
  /** Last grade opened in "Dərsliklə öyrən"; /kurikulum/ opens it again. */
  lastGrade: Grade | null;
  /**
   * Class code the student typed in "Dərsliklə öyrən" (FRONTEND_SPEC §10): it shows the topic the
   * teacher assigned and counts this device's anonymous events for that class. Kept on this device only.
   */
  classCode: string | null;
}

const DEFAULT_PREFS: Prefs = { lastGrade: null, classCode: null };

export const prefs = createStore<Prefs>("tarix:prefs", DEFAULT_PREFS, (raw) => {
  const r = (raw ?? {}) as Partial<Prefs>;
  return { lastGrade: isGrade(r.lastGrade) ? r.lastGrade : null, classCode: normalizeClassCode(r.classCode) };
});

export function usePrefs<S>(selector: (p: Prefs) => S): S {
  return useStore(prefs.store, (s) => selector(s.value));
}

export function setLastGrade(grade: Grade) {
  prefs.set((p) => ({ ...p, lastGrade: grade }));
}

/** Saves a class code; returns false (and keeps the old one) when it is not one. null forgets it. */
export function setClassCode(raw: string | null): boolean {
  if (raw === null) {
    prefs.set((p) => ({ ...p, classCode: null }));
    return true;
  }
  const code = normalizeClassCode(raw);
  if (!code) return false;
  prefs.set((p) => ({ ...p, classCode: code }));
  return true;
}
