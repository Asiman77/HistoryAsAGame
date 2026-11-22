/**
 * Dark UI palettes of the period themes (docs/FRONTEND_SPEC.md §3.2). Theme
 * data will carry its own `ui` block (backend B1); until then, and whenever
 * the data leaves it out, these values apply. Keys are the theme ids in
 * data/themes (ADR-0022): the spec's `aq-qoyunlu` is `turkman-tebriz`,
 * `safavid` is `sefevi`, `afsharid` is `efshar`, `victory-2020` is `muasir-zefer`.
 * Text and surface colours not in the spec table come from the design artboards
 * (docs/design: Simulation, StateSim, Victory, WarDay).
 */

export interface UiPalette {
  bg: string;
  bgRaised?: string;
  bgPanel?: string;
  accent: string;
  accentInk?: string;
  /** Second and third colour of the period (card tints, silhouettes, tiles). */
  secondary?: string[];
  text?: { primary?: string; secondary?: string; muted?: string };
  /** Eyebrow labels when they differ from the accent (2020: light blue). */
  eyebrow?: string;
}

const efshar: UiPalette = {
  bg: "#140E08",
  bgRaised: "#1C130B",
  bgPanel: "#1A110A",
  accent: "#E0B07A",
  secondary: ["#7A3A16"],
  text: { secondary: "#D2C2AA", muted: "#BFA98E" },
};

export const FALLBACK_UI: Record<string, UiPalette> = {
  default: {
    bg: "#0B1222",
    bgRaised: "#101A31",
    bgPanel: "#0E1730",
    accent: "#E2C27A",
    accentInk: "#1A1408",
    secondary: ["#2A4A8C", "#4FB3AE"],
  },
  /** Ağqoyunlu / Qaraqoyunlu: Tabriz miniature, lapis and gold. */
  "turkman-tebriz": { bg: "#0C1630", accent: "#C9A14A", secondary: ["#2A4A8C"] },
  /** Safavids: Qizilbash red, turquoise tiles. */
  sefevi: {
    bg: "#140A0C",
    bgPanel: "#1E0C0F",
    accent: "#E2C27A",
    secondary: ["#9E2A2B", "#4FB3AE"],
    text: { secondary: "#D8C6BC", muted: "#B8A493" },
  },
  /** Afsharids: harsh, military, bronze. */
  efshar,
  /** Indian campaign variant of efshar; the design has no own palette for it. */
  "efshar-hind": efshar,
  /** 2020: modern, solemn, flag colours. */
  "muasir-zefer": {
    bg: "#06111D",
    bgRaised: "#13263A",
    bgPanel: "#0A1828",
    accent: "#FFFFFF",
    accentInk: "#06111D",
    secondary: ["#00B5E2", "#509E2F"],
    text: { primary: "#FFFFFF", secondary: "#C8D6E0", muted: "#8EA4B4" },
    eyebrow: "#7FD9F2",
  },
};
