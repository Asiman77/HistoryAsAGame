"use client";

import { createStore as createZustandStore, useStore, type StoreApi } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";

export type StorageArea = "local" | "session";

/**
 * The Zustand state wraps the value, so any value (arrays included) survives
 * the persist middleware, which spreads the state into an object.
 */
export interface Boxed<T> {
  value: T;
}

/**
 * Storage that keeps the value itself under the key, without Zustand's
 * `{state, version}` wrapper or our box, so the keys written before Zustand
 * (tarix:settings, tarix:progress, tarix:navstack) keep their format and
 * nobody loses progress. Storage can be missing (private mode, blocked site
 * data): every access is guarded and the store then lives in memory.
 */
function rawStorage<T>(key: string, sanitize: (raw: unknown) => T, area: StorageArea): PersistStorage<Boxed<T>> {
  const target = () => (area === "local" ? window.localStorage : window.sessionStorage);
  return {
    getItem: () => {
      try {
        const raw = target().getItem(key);
        return raw ? { state: { value: sanitize(JSON.parse(raw)) }, version: 0 } : null;
      } catch {
        return null;
      }
    },
    setItem: (_name, stored) => {
      try {
        target().setItem(key, JSON.stringify(stored.state.value));
      } catch {}
    },
    removeItem: () => {
      try {
        target().removeItem(key);
      } catch {}
    },
  };
}

export interface PersistedStore<T> {
  /** The Zustand store; new code reads it with `useStore(store, (s) => s.value…)`. */
  store: StoreApi<Boxed<T>>;
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  /** The whole value; server render and hydration see the defaults. */
  useValue: () => T;
  defaults: T;
}

const pick = <T,>(s: Boxed<T>) => s.value;

/**
 * A Zustand store persisted under `key`. Other tabs' writes arrive through
 * the `storage` event. The value is replaced as a whole on every `set`.
 */
export function createStore<T>(key: string, defaults: T, sanitize: (raw: unknown) => T, area: StorageArea = "local"): PersistedStore<T> {
  const store = createZustandStore<Boxed<T>>()(
    persist(() => ({ value: defaults }), {
      name: key,
      storage: rawStorage(key, sanitize, area),
      // Hydrate in the browser only; the server renders the defaults.
      skipHydration: typeof window === "undefined",
    }),
  );

  if (typeof window !== "undefined" && area === "local") {
    window.addEventListener("storage", (e) => {
      if (e.key === key) void store.persist.rehydrate();
    });
  }

  const get = () => store.getState().value;
  const set = (next: T | ((prev: T) => T)) => {
    const value = typeof next === "function" ? (next as (p: T) => T)(get()) : next;
    store.setState({ value }, true);
  };

  return {
    store,
    get,
    set,
    subscribe: (listener) => store.subscribe(() => listener()),
    useValue: () => useStore(store, pick<T>),
    defaults,
  };
}

export const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
