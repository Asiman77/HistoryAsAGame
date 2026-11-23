import type { Mood } from "@/domain/schema";

/**
 * Colour family of a mood for timeline dots (Simulation artboard): calm
 * moments turquoise, rising ones gold, fights red, hard times grey.
 * Shape and label carry the meaning too; colour only groups.
 */
export function moodTone(mood: Mood): "calm" | "rise" | "fight" | "hard" {
  switch (mood) {
    case "birth":
    case "childhood":
    case "peace":
    case "diplomacy":
    case "culture":
      return "calm";
    case "journey":
    case "rise":
    case "coronation":
    case "victory":
      return "rise";
    case "battle":
    case "defeat":
      return "fight";
    default:
      return "hard";
  }
}

export const TONE_BG = { calm: "bg-claim-fact", rise: "bg-accent", fight: "bg-negative", hard: "bg-fg-muted" } as const;
export const TONE_BORDER = { calm: "border-claim-fact", rise: "border-accent", fight: "border-negative", hard: "border-fg-muted" } as const;
