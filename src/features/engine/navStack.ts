"use client";

import { createStore } from "@/lib/store";

/**
 * Return path for cross-links: before following a link into another
 * simulation we remember where we were (page + step), so the target can offer
 * "← back to Şah İsmayıl, Çaldıran". A Zustand store kept in sessionStorage
 * (per tab, FRONTEND_SPEC §4), same key and format as before.
 */
export interface ReturnEntry {
  /** Where to go back to, without locale, e.g. "/persons/shah-ismayil/?step=ismayil-chaldiran". */
  href: string;
  /** "Şah İsmayıl · Çaldıran döyüşü (1514)" */
  label: string;
  /** Path (without locale and query) of the page the link led to. */
  target: string;
}

const MAX = 20;

const isEntry = (e: unknown): e is ReturnEntry =>
  !!e && typeof e === "object" && ["href", "label", "target"].every((k) => typeof (e as Record<string, unknown>)[k] === "string");

export const navigationStack = createStore<ReturnEntry[]>("tarix:navstack", [], (raw) => (Array.isArray(raw) ? raw.filter(isEntry).slice(-MAX) : []), "session");

export function pushReturn(entry: ReturnEntry) {
  navigationStack.set((stack) => [...stack, entry].slice(-MAX));
}

/** The return entry for this page, if we arrived here through a cross-link. */
export function peekReturn(currentPath: string): ReturnEntry | null {
  const top = navigationStack.get().at(-1);
  return top && top.target === currentPath ? top : null;
}

export function popReturn(): ReturnEntry | null {
  const stack = navigationStack.get();
  const top = stack.at(-1) ?? null;
  navigationStack.set(stack.slice(0, -1));
  return top;
}

/** Strips the locale prefix and query: "/az/persons/x/?step=y" → "/persons/x/". */
export function pathOf(href: string): string {
  const noQuery = href.split("?")[0]!;
  return noQuery.replace(/^\/[a-z]{2}(?=\/)/, "");
}
