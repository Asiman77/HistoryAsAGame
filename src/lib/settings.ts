"use client";

import { CHANNELS, type Channel } from "@/features/audio/manifest";
import { clamp01, createStore } from "./store";

export interface Settings {
  /** Overall volume, 0..1. Defaults to a moderate level for classrooms. */
  master: number;
  /** One-click mute for everything. */
  muted: boolean;
  channels: Record<Channel, { volume: number; muted: boolean }>;
  /** Fewer animations and effects for weak school computers. null = decide from the device. */
  lightMode: boolean | null;
  /** Projector view: large text, teacher-driven stages and class quizzes. */
  teacherMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.55,
  muted: false,
  channels: {
    music: { volume: 0.7, muted: false },
    ambience: { volume: 0.5, muted: false },
    sfx: { volume: 0.7, muted: false },
    voice: { volume: 0.9, muted: false },
  },
  lightMode: null,
  teacherMode: false,
};

function sanitize(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const channels = { ...DEFAULT_SETTINGS.channels };
  for (const c of CHANNELS) {
    const v = r.channels?.[c];
    channels[c] = {
      volume: clamp01(v?.volume, DEFAULT_SETTINGS.channels[c].volume),
      muted: typeof v?.muted === "boolean" ? v.muted : false,
    };
  }
  return {
    master: clamp01(r.master, DEFAULT_SETTINGS.master),
    muted: typeof r.muted === "boolean" ? r.muted : false,
    channels,
    lightMode: typeof r.lightMode === "boolean" ? r.lightMode : null,
    teacherMode: typeof r.teacherMode === "boolean" ? r.teacherMode : false,
  };
}

export const settingsStore = createStore<Settings>("tarix:settings", DEFAULT_SETTINGS, sanitize);
export const useSettings = settingsStore.useValue;

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Settings)) {
  settingsStore.set((s) => (typeof patch === "function" ? patch(s) : { ...s, ...patch }));
}

export function setChannel(channel: Channel, patch: Partial<Settings["channels"][Channel]>) {
  settingsStore.set((s) => ({ ...s, channels: { ...s.channels, [channel]: { ...s.channels[channel], ...patch } } }));
}

/** Weak hardware guess used when the viewer has not chosen light mode explicitly. */
export function deviceLooksWeak(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
}

export function isLightMode(s: Settings): boolean {
  return s.lightMode ?? deviceLooksWeak();
}

/** Effective 0..1 level of a channel after master and mutes. */
export function channelLevel(s: Settings, c: Channel): number {
  if (s.muted || s.channels[c].muted) return 0;
  return s.master * s.channels[c].volume;
}
