import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, ensureContrast, fromOklch, mix, over, parseHex, toHex, toOklch } from "@/theme/color";
import { FALLBACK_UI } from "@/theme/fallbacks";
import { MIN_TEXT_CONTRAST, deriveUiPalette, fallbackThemeTokens, themeCss, themeTokens, tokensForTheme } from "@/theme/resolve";
import { BASE_THEME_TOKENS, BORDER_STRONG_SHARE, BORDER_SUBTLE_SHARE, STATIC_TOKENS, THEME_TOKENS, type ThemeTokens } from "@/theme/tokens";


const css = fs.readFileSync(path.resolve("src/styles/tokens.css"), "utf8");
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const cssValue = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(rootBlock)?.[1]?.trim();

describe("tokens.css and tokens.ts stay equal", () => {
  it.each([...THEME_TOKENS])("--%s", (name) => {
    expect(cssValue(name)?.toUpperCase()).toBe(BASE_THEME_TOKENS[name].toUpperCase());
  });
  it.each(Object.keys(STATIC_TOKENS))("--%s", (name) => {
    expect(cssValue(name)?.toUpperCase()).toBe(STATIC_TOKENS[name as keyof typeof STATIC_TOKENS].toUpperCase());
  });
  it("registers every theme token for the crossfade, with the default as initial value", () => {
    for (const name of THEME_TOKENS) {
      const m = new RegExp(`@property --${name} \\{[^}]*initial-value: (#[0-9A-Fa-f]{6})`).exec(css);
      expect(m?.[1]?.toUpperCase(), name).toBe(BASE_THEME_TOKENS[name]);
      expect(css).toContain(`--${name} var(--theme-duration) ease`);
    }
  });
  it("border tokens are the accent at the spec's shares", () => {
    expect(cssValue("border-subtle")).toBe(`color-mix(in srgb, var(--accent) ${BORDER_SUBTLE_SHARE * 100}%, transparent)`);
    expect(cssValue("border-strong")).toBe(`color-mix(in srgb, var(--accent) ${BORDER_STRONG_SHARE * 100}%, transparent)`);
  });
  it("the crossfade stays within 600–900 ms", () => {
    const ms = Number(/--theme-duration:\s*(\d+)ms/.exec(css)?.[1]);
    expect(ms).toBeGreaterThanOrEqual(600);
    expect(ms).toBeLessThanOrEqual(900);
  });
});

describe("colour toolkit", () => {
  it("parses and formats hex", () => {
    expect(parseHex("#e2c27a")).toEqual({ r: 226, g: 194, b: 122 });
    expect(toHex(parseHex("#abc"))).toBe("#AABBCC");
  });
  it("mixes like color-mix in srgb", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    // The spec's --border-subtle rgba(226,194,122,0.16) over the base ground.
    expect(over("#E2C27A", 0.16, "#0B1222")).toBe(mix("#0B1222", "#E2C27A", 0.16));
  });
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#777777")).toBe(1);
  });
  it("round-trips OKLCH", () => {
    for (const hex of ["#E2C27A", "#9E2A2B", "#2A4A8C", "#06111D", "#FFFFFF"]) expect(fromOklch(toOklch(hex))).toBe(hex);
  });
  it("lifts a colour until it reads, keeping it when it already does", () => {
    expect(ensureContrast("#F3E9D2", "#0B1222", 4.5)).toBe("#F3E9D2");
    const lifted = ensureContrast("#3A2414", "#0B1222", 4.5);
    expect(contrast(lifted, "#0B1222")).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(toOklch(lifted).h - toOklch("#3A2414").h)).toBeLessThan(3);
  });
});

/** Every pairing the components use as text on a surface. */
function readablePairs(t: ThemeTokens): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const surface of ["bg-base", "bg-raised", "bg-panel"] as const) {
    for (const text of ["text-primary", "text-secondary", "text-muted", "accent", "eyebrow"] as const) out.push([`${text} / ${surface}`, t[text], t[surface]]);
  }
  out.push(["accent-ink / accent", t["accent-ink"], t.accent]);
  return out;
}

describe("contrast: every theme passes WCAG 2.2 AA (≥ 4.5:1)", () => {
  const themes = fallbackThemeTokens();
  for (const [id, tokens] of Object.entries(themes)) {
    it.each(readablePairs(tokens))(`${id}: %s`, (_, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
  }

  it("claim badge colours read on every surface of every theme", () => {
    for (const tokens of Object.values(themes)) {
      for (const name of ["claim-fact", "claim-disputed", "claim-legend", "claim-literary"] as const) {
        // The badge sits on its own 12 % tint over the surface.
        const ground = over(STATIC_TOKENS[name], 0.12, tokens["bg-raised"]);
        expect(contrast(STATIC_TOKENS[name], ground), name).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    }
  });

  it("derived palettes pass for every era colour, however dark or pale", () => {
    const colours = ["#9b2c2c", "#1f3f6e", "#0a5c8a", "#7a1f1a", "#2f7f7a", "#111111", "#f2e6cc", "#5a3e8a", "#3a6b2a"];
    for (const c of colours) {
      const tokens = themeTokens(deriveUiPalette(c));
      for (const [label, fg, bg] of readablePairs(tokens)) expect(contrast(fg, bg), `${c} ${label}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

describe("theme resolution", () => {
  it("keeps the spec's values for the designed themes (§3.2)", () => {
    expect(tokensForTheme("default")).toEqual(BASE_THEME_TOKENS);
    expect(tokensForTheme("turkman-tebriz")).toMatchObject({ "bg-base": "#0C1630", accent: "#C9A14A", secondary: "#2A4A8C" });
    expect(tokensForTheme("sefevi")).toMatchObject({ "bg-base": "#140A0C", accent: "#E2C27A", secondary: "#9E2A2B", "secondary-2": "#4FB3AE" });
    expect(tokensForTheme("efshar")).toMatchObject({ "bg-base": "#140E08", accent: "#E0B07A", secondary: "#7A3A16" });
    expect(tokensForTheme("muasir-zefer")).toMatchObject({ "bg-base": "#06111D", accent: "#FFFFFF", "text-primary": "#FFFFFF" });
  });
  it("prefers data over the coded fallback, and derives when neither exists", () => {
    expect(tokensForTheme("sefevi", { bg: "#101010", accent: "#E2C27A" })["bg-base"]).toBe("#101010");
    const derived = tokensForTheme("some-new-era", undefined, "#2f7f7a");
    expect(derived.secondary).toBe("#2F7F7A");
    expect(derived["bg-base"]).toBe(mix("#07090F", "#2F7F7A", 0.14));
  });
  it("has a fallback for every theme in data/themes", () => {
    const ids = fs.readdirSync(path.resolve("data/themes")).map((f) => f.replace(/\.json$/, ""));
    for (const id of ids) expect(FALLBACK_UI[id], id).toBeDefined();
  });
  it("writes [data-theme] blocks with every token and rejects ids that are not slugs", () => {
    const out = themeCss({ sefevi: tokensForTheme("sefevi") });
    expect(out.startsWith('[data-theme="sefevi"]{')).toBe(true);
    for (const name of THEME_TOKENS) expect(out).toContain(`--${name}:`);
    expect(() => themeCss({ 'x"]{}*{': BASE_THEME_TOKENS })).toThrow();
  });
});
