"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store with a stable snapshot for useSyncExternalStore.
 * Storage can be missing (private mode, blocked site data): the store then
 * keeps working in memory for the session.
 */
export function createStore<T>(key: string, defaults: T, sanitize: (raw: unknown) => T) {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache !== undefined) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw ? sanitize(JSON.parse(raw)) : defaults;
    } catch {
      cache = defaults;
    }
    return cache;
  };

  const set = (next: T | ((prev: T) => T)) => {
    cache = typeof next === "function" ? (next as (p: T) => T)(read()) : next;
    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch {}
    listeners.forEach((l) => l());
  };

  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      cache = undefined;
      l();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };

  const useValue = (): T => useSyncExternalStore(subscribe, read, () => defaults);

  return { get: read, set, subscribe, useValue, defaults };
}

export const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
