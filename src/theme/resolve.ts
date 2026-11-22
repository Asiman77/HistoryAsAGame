import { ensureContrast, luminance, mix, parseHex, toHex, withLightness } from "./color";
import { FALLBACK_UI, type UiPalette } from "./fallbacks";
import { BASE_THEME_TOKENS, THEME_TOKENS, type ThemeTokens } from "./tokens";

/** WCAG 2.2 AA for body text, small grey labels included (§11). */
export const MIN_TEXT_CONTRAST = 4.5;

/** Upper-case #RRGGBB, so generated CSS and tests compare one spelling. */
const norm = (c: string) => toHex(parseHex(c));

/** Near-black the derived backgrounds start from. */
const NIGHT = "#07090F";

/**
 * Dark palette derived from one period colour, for eras without a designed
 * theme ("digər dövrlər", §3.2): the background is night tinted with the
 * colour, the accent is the same hue made light enough to read.
 */
export function deriveUiPalette(color: string): UiPalette {
  return { bg: mix(NIGHT, color, 0.14), accent: withLightness(color, 0.84, 0.11), secondary: [color] };
}

/** Palette of a theme: its own data first, then the coded fallback, then a palette derived from its main colour. */
export function uiPaletteFor(themeId: string, dataUi?: UiPalette, primary?: string): UiPalette {
  return dataUi ?? FALLBACK_UI[themeId] ?? deriveUiPalette(primary ?? BASE_THEME_TOKENS.accent);
}

/**
 * Full token set of a palette. Missing surfaces are mixed from the background
 * and the period colour; every text colour and the accent are lifted until
 * they pass AA on the lightest surface, so a careless palette cannot ship
 * unreadable text.
 */
export function themeTokens(ui: UiPalette): ThemeTokens {
  const secondary = norm(ui.secondary?.[0] ?? BASE_THEME_TOKENS.secondary);
  const bg = norm(ui.bg);
  const raised = norm(ui.bgRaised ?? mix(bg, secondary, 0.14));
  const panel = norm(ui.bgPanel ?? mix(bg, secondary, 0.08));
  const lightest = [bg, raised, panel].reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
  const readable = (c: string) => norm(ensureContrast(c, lightest, MIN_TEXT_CONTRAST));
  const accent = readable(ui.accent);
  return {
    "bg-base": bg,
    "bg-raised": raised,
    "bg-panel": panel,
    "text-primary": readable(ui.text?.primary ?? BASE_THEME_TOKENS["text-primary"]),
    "text-secondary": readable(ui.text?.secondary ?? BASE_THEME_TOKENS["text-secondary"]),
    "text-muted": readable(ui.text?.muted ?? BASE_THEME_TOKENS["text-muted"]),
    accent,
    "accent-ink": norm(ensureContrast(ui.accentInk ?? withLightness(accent, 0.2, 0.03), accent, MIN_TEXT_CONTRAST)),
    eyebrow: readable(ui.eyebrow ?? accent),
    secondary,
    "secondary-2": norm(ui.secondary?.[1] ?? BASE_THEME_TOKENS["secondary-2"]),
  };
}

/** Token set of a theme id (see `uiPaletteFor`). */
export function tokensForTheme(themeId: string, dataUi?: UiPalette, primary?: string): ThemeTokens {
  return themeTokens(uiPaletteFor(themeId, dataUi, primary));
}

/** CSS custom properties of a token set, e.g. for an inline `style`. */
export function cssVars(tokens: ThemeTokens): Record<`--${string}`, string> {
  return Object.fromEntries(THEME_TOKENS.map((k) => [`--${k}`, tokens[k]])) as Record<`--${string}`, string>;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `[data-theme="id"]{…}` blocks for the given themes, injected once per page. */
export function themeCss(themes: Record<string, ThemeTokens>): string {
  return Object.entries(themes)
    .map(([id, tokens]) => {
      if (!SLUG.test(id)) throw new Error(`tema id-si slug deyil: ${id}`);
      const body = THEME_TOKENS.map((k) => `--${k}:${tokens[k]}`).join(";");
      return `[data-theme="${id}"]{${body}}`;
    })
    .join("\n");
}

/** Every coded fallback theme, resolved (Storybook, tests, pages without theme data). */
export function fallbackThemeTokens(): Record<string, ThemeTokens> {
  return Object.fromEntries(Object.entries(FALLBACK_UI).map(([id, ui]) => [id, themeTokens(ui)]));
}
