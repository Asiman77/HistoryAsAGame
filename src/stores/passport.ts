"use client";

import { useStore } from "zustand";
import { createStore } from "@/lib/store";

/**
 * Tarix pasportu (§6.9, §10): a stamp for every place the student reached in
 * a simulation. Only on this device (localStorage), no account, no names.
 */
export interface Stamp {
  /** First visit, ms since epoch. */
  at: number;
  /** Simulation that brought the student here first ("shah-ismayil"). */
  from: string;
  /** Shown with its stamp animation on a final screen already. */
  seen: boolean;
}

export interface Passport {
  stamps: Record<string, Stamp>;
}

const EMPTY: Passport = { stamps: {} };

function sanitize(raw: unknown): Passport {
  const r = raw as Partial<Passport> | null;
  if (!r || typeof r !== "object" || !r.stamps || typeof r.stamps !== "object") return EMPTY;
  const stamps: Record<string, Stamp> = {};
  for (const [id, s] of Object.entries(r.stamps)) {
    if (!s || typeof s !== "object" || typeof s.from !== "string") continue;
    stamps[id] = { at: typeof s.at === "number" ? s.at : 0, from: s.from, seen: !!s.seen };
  }
  return { stamps };
}

export const passport = createStore<Passport>("tarix:passport", EMPTY, sanitize);

export function usePassport<S>(selector: (p: Passport) => S): S {
  return useStore(passport.store, (s) => selector(s.value));
}

/** Stamps places reached in a simulation; places stamped before keep their first visit. */
export function stampPlaces(ids: string[], from: string) {
  const now = Date.now();
  const missing = ids.filter((id) => !passport.get().stamps[id]);
  if (!missing.length) return;
  passport.set((p) => ({ stamps: { ...p.stamps, ...Object.fromEntries(missing.map((id) => [id, { at: now, from, seen: false }])) } }));
}

/** The final screen has played the stamp animation for these. */
export function markStampsSeen(ids: string[]) {
  const unseen = ids.filter((id) => passport.get().stamps[id] && !passport.get().stamps[id]!.seen);
  if (!unseen.length) return;
  passport.set((p) => ({ stamps: { ...p.stamps, ...Object.fromEntries(unseen.map((id) => [id, { ...p.stamps[id]!, seen: true }])) } }));
}
