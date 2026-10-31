"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Mode } from "./StoryContent";

const KEY = "tarix:mode";
const EVENT = "tarix:mode-change";

// Story/learn mode is a per-viewer convenience; storage may be unavailable.
function read(): Mode {
  try {
    return localStorage.getItem(KEY) === "learn" ? "learn" : "story";
  } catch {
    return "story";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useStoredMode(): [Mode, (m: Mode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => "story" as const);
  const set = useCallback((next: Mode) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, set];
}
