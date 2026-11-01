import type { Mood } from "@/domain/schema";

export interface MoodStyle {
  /** UI accent (badges, progress, highlights). */
  accent: string;
  /** Colour laid over the map with `mix-blend-mode: multiply`. */
  grade: string;
  /** Strength of the grade, 0..1. */
  gradeOpacity: number;
  /** Strength of the dark vignette, 0..1. */
  vignette: number;
}

/**
 * Colour grading per mood: battle is a dark reddish tone, peace a warm gold,
 * exile a cold grey-blue. Accents keep at least 4.5:1 contrast on parchment.
 */
export const MOOD_STYLES: Record<Mood, MoodStyle> = {
  birth: { accent: "#9a5b2e", grade: "#f3d9b0", gradeOpacity: 0.25, vignette: 0.3 },
  childhood: { accent: "#8a6420", grade: "#f1e0b5", gradeOpacity: 0.2, vignette: 0.3 },
  hardship: { accent: "#6e5340", grade: "#a69a88", gradeOpacity: 0.3, vignette: 0.45 },
  exile: { accent: "#3f5b74", grade: "#9fb1c2", gradeOpacity: 0.38, vignette: 0.5 },
  journey: { accent: "#7a5a17", grade: "#e6cf9a", gradeOpacity: 0.2, vignette: 0.35 },
  rise: { accent: "#8a6a10", grade: "#f0cf7a", gradeOpacity: 0.25, vignette: 0.3 },
  coronation: { accent: "#6b3a7a", grade: "#e9c46a", gradeOpacity: 0.3, vignette: 0.35 },
  battle: { accent: "#8f2424", grade: "#b5574a", gradeOpacity: 0.32, vignette: 0.6 },
  victory: { accent: "#8a4a12", grade: "#e8b860", gradeOpacity: 0.28, vignette: 0.35 },
  defeat: { accent: "#6a2a2a", grade: "#8c6f6a", gradeOpacity: 0.38, vignette: 0.6 },
  peace: { accent: "#7a5a10", grade: "#f2d68c", gradeOpacity: 0.25, vignette: 0.25 },
  diplomacy: { accent: "#23446b", grade: "#b9c9d4", gradeOpacity: 0.22, vignette: 0.3 },
  culture: { accent: "#1f6b66", grade: "#cfe0cf", gradeOpacity: 0.22, vignette: 0.3 },
  decline: { accent: "#6d4a22", grade: "#b8926a", gradeOpacity: 0.32, vignette: 0.5 },
  death: { accent: "#4a3a4e", grade: "#8a8090", gradeOpacity: 0.4, vignette: 0.6 },
};
