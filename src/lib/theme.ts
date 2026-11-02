import type { Era, FontKey, Mood, MoodTone, Theme, ThemeFile } from "@/domain/schema";
import { MOOD_STYLES } from "./mood";

/**
 * Themes are data (data/themes). This module merges variants into full themes,
 * picks the theme of a step (step → entity → era → default) and turns a theme
 * plus the current mood into CSS custom properties.
 */

export const DEFAULT_THEME_ID = "default";
export const DEFAULT_LINK = "#23446b";

export type ThemeMap = Record<string, Theme>;

/** Merge every variant over its parent chain; throws on unknown parents and cycles. */
export function resolveThemes(files: ThemeFile[]): ThemeMap {
  const byId = new Map(files.map((f) => [f.id, f]));
  const out: ThemeMap = {};
  const resolve = (id: string, seen: string[]): Theme => {
    if (out[id]) return out[id];
    const f = byId.get(id);
    if (!f) throw new Error(`tema tapılmadı: ${id}${seen.length ? ` (${seen.join(" → ")})` : ""}`);
    if (seen.includes(id)) throw new Error(`temada dövri miras: ${[...seen, id].join(" → ")}`);
    if (!("extends" in f)) return (out[id] = f);
    const parent = resolve(f.extends, [...seen, id]);
    const theme: Theme = {
      id: f.id,
      name: f.name,
      palette: { ...parent.palette, ...f.palette },
      fonts: { ...parent.fonts, ...f.fonts },
      textures: { ...parent.textures, ...f.textures },
      ornaments: { ...parent.ornaments, ...f.ornaments },
      backgroundArt: f.backgroundArt ?? parent.backgroundArt,
      ambientEffect: f.ambientEffect ?? parent.ambientEffect,
      mapStyleVariant: f.mapStyleVariant ?? parent.mapStyleVariant,
      musicThemeId: f.musicThemeId ?? parent.musicThemeId,
      ...(parent.moodTones || f.moodTones ? { moodTones: { ...parent.moodTones, ...f.moodTones } } : {}),
    };
    return (out[id] = theme);
  };
  for (const f of files) resolve(f.id, []);
  return out;
}

/** An era as the client needs it: with the colour of its theme for timelines and chips. */
export interface EraView extends Era {
  color: string;
}

export function eraViews(eras: Era[], themes: ThemeMap): EraView[] {
  return eras.map((e) => ({ ...e, color: (themes[e.themeId] ?? themes[DEFAULT_THEME_ID])?.palette.primary ?? "#8a6a2f" }));
}

/** Only the themes a page uses, so the payload stays small. */
export function pickThemes(themes: ThemeMap, ids: Iterable<string>): ThemeMap {
  const out: ThemeMap = {};
  for (const id of ids) {
    const t = themes[id] ?? themes[DEFAULT_THEME_ID];
    if (t) out[id] = t;
  }
  if (themes[DEFAULT_THEME_ID]) out[DEFAULT_THEME_ID] = themes[DEFAULT_THEME_ID];
  return out;
}

/**
 * Theme of a list page: the period all its entities share (e.g. every war so
 * far is 2020), or the neutral default when they span several periods.
 */
export function sharedTheme(themes: ThemeMap, eras: Era[], entities: { eraIds: string[]; themeId?: string | undefined }[]): Theme {
  const ids = new Set(entities.map((e) => e.themeId ?? eras.find((x) => x.id === e.eraIds[0])?.themeId ?? DEFAULT_THEME_ID));
  const only = ids.size === 1 ? [...ids][0]! : DEFAULT_THEME_ID;
  return themes[only] ?? themes[DEFAULT_THEME_ID]!;
}

/**
 * Era of a year. Eras overlap at dynastic changes (Ağqoyunlu ends 1503, Səfəvi
 * starts 1501): the one that began most recently wins, so 1501 is Safavid.
 */
export function eraForYear<E extends Pick<Era, "startYear" | "endYear">>(eras: E[], year: number): E | undefined {
  let best: E | undefined;
  for (const e of eras) if (year >= e.startYear && year <= e.endYear && (!best || e.startYear > best.startYear)) best = e;
  return best;
}

/**
 * Theme of one step: its own variant, else the entity override, else the era of
 * the year (among the entity's eras first, then all eras), else the default.
 */
export function pickThemeId(opts: {
  stepThemeId?: string | undefined;
  entityThemeId?: string | undefined;
  year: number;
  entityEras: Era[];
  allEras: Era[];
}): string {
  return (
    opts.stepThemeId ??
    opts.entityThemeId ??
    eraForYear(opts.entityEras, opts.year)?.themeId ??
    eraForYear(opts.allEras, opts.year)?.themeId ??
    opts.entityEras[0]?.themeId ??
    DEFAULT_THEME_ID
  );
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear sRGB mix; `t` is the share of `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as RGB);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Mood inside a theme
// ---------------------------------------------------------------------------

/** Default tone of a mood, derived from the shared map grading; themes may override per mood. */
export function moodTone(theme: Theme, mood: Mood | null): MoodTone {
  if (!mood) return { tint: theme.palette.surface, strength: 0, brightness: 1 };
  const own = theme.moodTones?.[mood];
  if (own) return own;
  const s = MOOD_STYLES[mood];
  return { tint: s.grade, strength: Math.min(0.08, s.gradeOpacity * 0.22), brightness: Math.round((1.18 - s.vignette * 0.75) * 100) / 100 };
}

/** The four colours actually painted, with the mood drift applied to the surface. */
export interface ToneColors {
  primary: string;
  accent: string;
  surface: string;
  text: string;
  link: string;
}

export function toneColors(theme: Theme, mood: Mood | null): ToneColors {
  const tone = moodTone(theme, mood);
  const p = theme.palette;
  return {
    primary: p.primary,
    accent: p.accent,
    surface: mix(p.surface, tone.tint, tone.strength),
    text: p.text,
    link: p.link ?? DEFAULT_LINK,
  };
}

/** Text tones derived from text and surface (mirrors the CSS in globals.css). */
export const SOFT_TEXT_SHARE = 0.78;
export const FAINT_TEXT_SHARE = 0.62;

export function derivedText(c: Pick<ToneColors, "text" | "surface">) {
  return { soft: mix(c.surface, c.text, SOFT_TEXT_SHARE), faint: mix(c.surface, c.text, FAINT_TEXT_SHARE) };
}

/** Contrast problems of a theme in every mood; used by the data validator and tests. */
export function themeContrastIssues(theme: Theme, moods: readonly Mood[]): string[] {
  const issues: string[] = [];
  for (const mood of [null, ...moods]) {
    const c = toneColors(theme, mood);
    const where = mood ? `${theme.id}/${mood}` : theme.id;
    const { soft, faint } = derivedText(c);
    const pairs: [string, string, number][] = [
      ["mətn", c.text, 7],
      ["ikinci dərəcəli mətn", soft, 4.5],
      ["solğun mətn", faint, 3],
      ["primary", c.primary, 4.5],
      ["link", c.link, 4.5],
    ];
    for (const [label, color, min] of pairs) {
      const r = contrast(color, c.surface);
      if (r < min) issues.push(`${where}: ${label} fonda oxunaqlı deyil (${r.toFixed(2)} < ${min})`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// CSS variables
// ---------------------------------------------------------------------------

/** CSS variable of each loaded font (set by next/font in src/app/layout.tsx). */
export const FONT_VARS: Record<FontKey, string> = {
  "noto-serif-display": "var(--font-noto-serif-display)",
  "noto-serif": "var(--font-noto-serif)",
  "noto-sans": "var(--font-noto-sans)",
  "cormorant-garamond": "var(--font-cormorant-garamond)",
  "alegreya-sc": "var(--font-alegreya-sc)",
  "spectral-sc": "var(--font-spectral-sc)",
  montserrat: "var(--font-montserrat)",
};

/** Custom properties that make every `bg-parchment`, `text-ink`, `text-carmine`... follow the theme. */
export function themeVars(theme: Theme, mood: Mood | null): Record<string, string> {
  const c = toneColors(theme, mood);
  const tone = moodTone(theme, mood);
  return {
    "--theme-primary": c.primary,
    "--theme-accent": c.accent,
    "--theme-surface": c.surface,
    "--theme-text": c.text,
    "--theme-link": c.link,
    "--theme-tint": tone.tint,
    "--theme-art-brightness": String(tone.brightness),
    "--theme-font-display": FONT_VARS[theme.fonts.display],
    "--theme-font-body": FONT_VARS[theme.fonts.body],
  };
}

export function cssText(selector: string, vars: Record<string, string>): string {
  return `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}
