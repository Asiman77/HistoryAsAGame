/**
 * Small colour toolkit for the design system: hex parsing, sRGB mixing
 * (same result as CSS `color-mix(in srgb, …)`), WCAG contrast and OKLCH,
 * which keeps hue and chroma stable when a theme colour is lightened.
 */

export type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`hex rəng deyil: ${hex}`);
  let h = m[1]!;
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => byte(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** `share` of `b` mixed into `a`, in gamma-encoded sRGB like `color-mix(in srgb, a, b share)`. */
export function mix(a: string, b: string, share: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex({ r: x.r + (y.r - x.r) * share, g: x.g + (y.g - x.g) * share, b: x.b + (y.b - x.b) * share });
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const encode = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Colour of a translucent foreground over an opaque background, e.g. a token
 * like `rgba(226,194,122,0.16)` over the page, so its contrast can be tested.
 */
export function over(fg: string, alpha: number, bg: string): string {
  return mix(bg, fg, alpha);
}

export type Oklch = { l: number; c: number; h: number };

export function toOklch(hex: string): Oklch {
  const { r, g, b } = parseHex(hex);
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

export function fromOklch({ l: L, c, h }: Oklch): string {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return toHex({
    r: encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  });
}

/** Same hue, given OKLCH lightness and at most `maxChroma`. */
export function withLightness(hex: string, l: number, maxChroma = 0.4): string {
  const o = toOklch(hex);
  return fromOklch({ l, c: Math.min(o.c, maxChroma), h: o.h });
}

/**
 * Lightens (on dark backgrounds) or darkens `fg` in OKLCH, keeping its hue,
 * until it reaches `min` contrast against `bg`. Returns `fg` when it already does.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const start = toOklch(fg);
  const up = luminance(bg) < 0.18;
  for (let step = 1; step <= 100; step++) {
    const l = up ? start.l + ((1 - start.l) * step) / 100 : start.l * (1 - step / 100);
    const candidate = fromOklch({ ...start, l });
    if (contrast(candidate, bg) >= min) return candidate;
  }
  return up ? "#FFFFFF" : "#000000";
}
