import type { Mood } from "@/domain/schema";

/**
 * What plays when. Files live in public/audio/<file>.webm and .mp3; see
 * AUDIO_CREDITS.md for their origin and licence. To swap a placeholder for a
 * real recording, replace both files and keep the name.
 */

export const CHANNELS = ["music", "ambience", "sfx", "voice"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Layer {
  file: string;
  /** Length of the generated loop; the engine crossfades passes into each other. */
  seconds: number;
  /** Mix level inside its channel. */
  gain: number;
}

export const MUSIC_LAYERS = {
  base: { file: "music-base", seconds: 32, gain: 0.45 },
  peace: { file: "music-peace", seconds: 30, gain: 0.8 },
  kamancha: { file: "music-kamancha", seconds: 30, gain: 0.8 },
  balaban: { file: "music-balaban", seconds: 32, gain: 0.85 },
  battle: { file: "music-battle", seconds: 26, gain: 0.75 },
  festive: { file: "music-festive", seconds: 26, gain: 0.7 },
  journey: { file: "music-journey", seconds: 26, gain: 0.7 },
  qanun: { file: "music-qanun", seconds: 26, gain: 0.7 },
} as const satisfies Record<string, Layer>;
export type MusicLayer = keyof typeof MUSIC_LAYERS;

export const AMBIENCE_LAYERS = {
  wind: { file: "amb-wind", seconds: 20, gain: 0.55 },
  crowd: { file: "amb-crowd", seconds: 20, gain: 0.5 },
  hooves: { file: "amb-hooves", seconds: 16, gain: 0.55 },
  market: { file: "amb-market", seconds: 20, gain: 0.45 },
} as const satisfies Record<string, Layer>;
export type AmbienceLayer = keyof typeof AMBIENCE_LAYERS;

/** One file for all short effects: name → [offset ms, duration ms]. */
export const AUDIO_SPRITE = {
  file: "sfx-sprite",
  sprite: {
    whoosh: [0, 900],
    sword: [1000, 1100],
    cannon: [2300, 1900],
    drum: [4400, 700],
    page: [5300, 450],
    chime: [6000, 1800],
    victory: [8000, 2200],
  },
} as const satisfies { file: string; sprite: Record<string, readonly [number, number]> };
export type SfxName = keyof typeof AUDIO_SPRITE.sprite;

export interface MoodSound {
  /** Plays on top of the always-on `base` layer. */
  music: MusicLayer[];
  ambience: AmbienceLayer[];
}

/**
 * Battle: nağara and zurna. Peace: tar and kamança. Death: balaban.
 * Every mood keeps the shared `base` drone underneath, so changes are crossfades, not cuts.
 */
export const MOOD_SOUND: Record<Mood, MoodSound> = {
  birth: { music: ["qanun"], ambience: [] },
  childhood: { music: ["peace"], ambience: [] },
  hardship: { music: ["kamancha"], ambience: ["wind"] },
  exile: { music: ["kamancha"], ambience: ["wind"] },
  journey: { music: ["journey"], ambience: ["hooves"] },
  rise: { music: ["festive"], ambience: ["crowd"] },
  coronation: { music: ["festive", "qanun"], ambience: ["crowd"] },
  battle: { music: ["battle"], ambience: ["hooves", "crowd"] },
  victory: { music: ["festive"], ambience: ["crowd"] },
  defeat: { music: ["balaban"], ambience: ["wind"] },
  peace: { music: ["peace"], ambience: ["market"] },
  diplomacy: { music: ["qanun"], ambience: ["market"] },
  culture: { music: ["qanun", "peace"], ambience: ["market"] },
  decline: { music: ["kamancha"], ambience: ["wind"] },
  death: { music: ["balaban"], ambience: ["wind"] },
};

export const MUSIC_CROSSFADE_MS = 1600;

export function audioSources(base: string, file: string): string[] {
  return [`${base}/audio/${file}.webm`, `${base}/audio/${file}.mp3`];
}
