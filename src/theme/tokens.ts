/**
 * Design tokens (docs/FRONTEND_SPEC.md §3.1). The CSS source of truth is
 * src/styles/tokens.css; these values mirror it for code that needs concrete
 * colours (contrast tests, theme CSS generation, MapLibre paint), and
 * tests/unit/designTokens.test.ts keeps the two equal.
 */

/** Tokens a period theme may override. They crossfade when the theme changes. */
export const THEME_TOKENS = [
  "bg-base",
  "bg-raised",
  "bg-panel",
  "text-primary",
  "text-secondary",
  "text-muted",
  "accent",
  "accent-ink",
  "eyebrow",
  "secondary",
  "secondary-2",
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];
export type ThemeTokens = Record<ThemeToken, string>;

/** The default theme: night navy, parchment text, gold. */
export const BASE_THEME_TOKENS: ThemeTokens = {
  "bg-base": "#0B1222",
  "bg-raised": "#101A31",
  "bg-panel": "#0E1730",
  "text-primary": "#F3E9D2",
  "text-secondary": "#CFC3A8",
  "text-muted": "#A99D84",
  accent: "#E2C27A",
  "accent-ink": "#1A1408",
  eyebrow: "#E2C27A",
  /** Lapis of the hero mountains and the default card tint. */
  secondary: "#2A4A8C",
  /** Turquoise of tiles and arches. */
  "secondary-2": "#4FB3AE",
};

/** Tokens that never change with the period. */
export const STATIC_TOKENS = {
  "claim-fact": "#4FB3AE",
  "claim-disputed": "#E2A04A",
  "claim-legend": "#B9A8D6",
  "claim-literary": "#A99D84",
  negative: "#E86A5C",
  "map-parchment-center": "#E9D7AE",
  "map-parchment-mid": "#CFB37C",
  "map-parchment-edge": "#6E4A2A",
  "map-water": "#7FA3A1",
  "map-ink": "#3A2414",
  "flag-blue": "#00B5E2",
  "flag-red": "#EF3340",
  "flag-green": "#509E2F",
  "sky-night": "#050E1A",
  "sky-dusk": "#0A1F36",
  "sky-horizon": "#183048",
  "dawn-glow": "#FFAA5A",
} as const;
export type StaticToken = keyof typeof STATIC_TOKENS;

/** Shares of the accent in the translucent border tokens (`color-mix` in tokens.css). */
export const BORDER_SUBTLE_SHARE = 0.16;
export const BORDER_STRONG_SHARE = 0.4;

/** Theme crossfade, within the 600–900 ms the spec asks for. */
export const THEME_TRANSITION_MS = 750;

/** Font size scale in px (§3.3). Tailwind: `text-12` … `text-88`. */
export const FONT_SIZES = [12, 13, 14, 15, 16, 19, 22, 26, 30, 34, 38, 44, 48, 60, 76, 88] as const;
