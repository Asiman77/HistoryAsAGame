"use client";

import { create } from "zustand";
import type { SheetSnap } from "@/components/ui/BottomSheet";

/**
 * State of the simulation on screen (not persisted). The shell drives it;
 * other parts (sound in phase 12, projector mode in 13) read it.
 */
export interface SimulationState {
  /** Step the viewer asked for (index into ShellData.steps). */
  index: number;
  /** Step whose text the panel shows; null while the old text has left and the new one is not in yet. */
  contentIndex: number | null;
  /** Step of the counters and the portrait. */
  counterIndex: number;
  /** Delay between the parts of the new text (ms). */
  stagger: number;
  /** id of the last step whose transition has finished (autoplay waits for it). */
  readyKey: string | null;
  playing: boolean;
  panelOpen: boolean;
  sheet: SheetSnap;
  announcement: string;
  set: (patch: Partial<Omit<SimulationState, "set" | "reset">>) => void;
  reset: (index: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  index: 0,
  contentIndex: null,
  counterIndex: 0,
  stagger: 0,
  readyKey: null,
  playing: false,
  panelOpen: true,
  sheet: "half",
  announcement: "",
  set: (patch) => set(patch),
  reset: (index) => set({ index, contentIndex: null, counterIndex: index, stagger: 0, readyKey: null, playing: false, panelOpen: true, sheet: "half", announcement: "" }),
}));
