import { describe, expect, it } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import { MOODS, type Era, type Theme, type ThemeFile } from "@/domain/schema";
import { MUSIC_THEMES, musicThemeSound } from "@/features/audio/manifest";
import { buildJourney } from "@/features/simulation/model";
import {
  contrast,
  mix,
  moodTone,
  pickThemeId,
  resolveThemes,
  sharedTheme,
  themeContrastIssues,
  themeVars,
  toneColors,
} from "@/lib/theme";

const base: Theme = {
  id: "base",
  name: { az: "Baza" },
  palette: { primary: "#9b2c2c", accent: "#b8862b", surface: "#f2e6cc", text: "#2a1c10" },
  fonts: { display: "noto-serif-display", body: "noto-sans" },
  textures: { background: "parchment", paper: "parchment", frame: "parchment" },
  ornaments: { border: "double-rule", divider: "star", corner: "rosette" },
  backgroundArt: [],
  ambientEffect: "dust",
  mapStyleVariant: "manuscript",
  musicThemeId: "klassik",
  moodTones: { battle: { tint: "#5a1a14", strength: 0.12, brightness: 0.55 } },
};

describe("resolveThemes", () => {
  it("merges a variant section by section over its parent", () => {
    const variant: ThemeFile = { id: "v", name: { az: "V" }, extends: "base", palette: { accent: "#9a6f17" }, ornaments: { corner: "rivet" } };
    const t = resolveThemes([base, variant]);
    expect(t.v!.palette).toEqual({ ...base.palette, accent: "#9a6f17" });
    expect(t.v!.ornaments).toEqual({ border: "double-rule", divider: "star", corner: "rivet" });
    expect(t.v!.fonts).toEqual(base.fonts);
    expect(t.v!.moodTones?.battle?.brightness).toBe(0.55);
  });
  it("rejects unknown parents and cycles", () => {
    expect(() => resolveThemes([{ id: "x", name: { az: "x" }, extends: "nope" }])).toThrow(/tapılmadı/);
    expect(() =>
      resolveThemes([
        { id: "a", name: { az: "a" }, extends: "b" },
        { id: "b", name: { az: "b" }, extends: "a" },
      ]),
    ).toThrow(/dövri/);
  });
});

describe("pickThemeId", () => {
  const eras = [
    { id: "agqoyunlu", startYear: 1378, endYear: 1503, themeId: "turkman-tebriz" },
    { id: "sefevi", startYear: 1501, endYear: 1736, themeId: "sefevi" },
  ] as Era[];
  it("prefers step, then entity, then the era of the year", () => {
    expect(pickThemeId({ stepThemeId: "hind", entityThemeId: "efshar", year: 1739, entityEras: eras, allEras: eras })).toBe("hind");
    expect(pickThemeId({ entityThemeId: "efshar", year: 1700, entityEras: eras, allEras: eras })).toBe("efshar");
    expect(pickThemeId({ year: 1490, entityEras: eras, allEras: eras })).toBe("turkman-tebriz");
    expect(pickThemeId({ year: 1514, entityEras: eras, allEras: eras })).toBe("sefevi");
  });
  it("falls back to the default outside every era", () => {
    expect(pickThemeId({ year: 1900, entityEras: [], allEras: eras })).toBe("default");
  });
});

describe("mood inside a theme", () => {
  it("darkens the backdrop in battle and brightens it at a coronation", () => {
    expect(moodTone(base, "battle").brightness).toBeLessThan(moodTone(base, "coronation").brightness);
    expect(moodTone(base, null)).toEqual({ tint: base.palette.surface, strength: 0, brightness: 1 });
  });
  it("only drifts the surface a little", () => {
    const c = toneColors(base, "battle");
    expect(c.surface).toBe(mix(base.palette.surface, "#5a1a14", 0.12));
    expect(contrast(c.text, c.surface)).toBeGreaterThan(7);
  });
  it("exposes CSS variables for colours and fonts", () => {
    const v = themeVars(base, "peace");
    expect(v["--theme-primary"]).toBe("#9b2c2c");
    expect(v["--theme-font-display"]).toBe("var(--font-noto-serif-display)");
    expect(v["--theme-link"]).toBe("#23446b");
  });
});

describe("music themes", () => {
  it("klassik leaves the shared mood map in charge; zefer-2020 has its own", () => {
    expect(musicThemeSound("klassik", "battle")).toBeUndefined();
    expect(musicThemeSound("zefer-2020", "battle")?.music).toEqual(["march"]);
    expect(musicThemeSound("zefer-2020", "death")?.music).toEqual(["lament"]);
    expect(Object.keys(MUSIC_THEMES)).toContain("klassik");
  });
});

describe("data/themes", async () => {
  const repo = new FileSystemRepository();
  const [themes, eras] = await Promise.all([repo.listThemes(), repo.listEras()]);

  it("has a default and a theme for every era", () => {
    expect(themes.default).toBeDefined();
    for (const e of eras) expect(themes[e.themeId], e.id).toBeDefined();
  });
  it("keeps text legible in every mood", () => {
    for (const t of Object.values(themes)) expect(themeContrastIssues(t, MOODS)).toEqual([]);
  });
  it("Hind yürüşü variant inherits Əfşar fonts and swaps the art", () => {
    expect(themes["efshar-hind"]!.fonts).toEqual(themes.efshar!.fonts);
    expect(themes["efshar-hind"]!.backgroundArt[0]!.src).toBe("/backgrounds/mughal-shahbarghan");
  });
  it("list pages take the shared period or the neutral default", () => {
    expect(sharedTheme(themes, eras, [{ eraIds: ["muasir"] }]).id).toBe("muasir-zefer");
    expect(sharedTheme(themes, eras, [{ eraIds: ["muasir"] }, { eraIds: ["sefevi"] }]).id).toBe("default");
  });

  it("Şah İsmayıl moves from the Turkman theme to the Safavid one; Nadir's Indian campaign uses its variant", async () => {
    const ismayil = buildJourney((await repo.getPerson("shah-ismayil"))!, await repo.getEvents("shah-ismayil"), eras);
    const byId = Object.fromEntries(ismayil.steps.map((s) => [s.id, s.themeId]));
    expect(ismayil.steps[0]!.themeId).toBe("turkman-tebriz");
    expect(byId["ismayil-coronation"]).toBe("sefevi");

    const nadir = buildJourney((await repo.getPerson("nadir-shah"))!, await repo.getEvents("nadir-shah"), eras);
    const nb = Object.fromEntries(nadir.steps.map((s) => [s.id, s.themeId]));
    expect(nb["nadir-birth"]).toBe("efshar");
    expect(nb["nadir-karnal"]).toBe("efshar-hind");
    expect(nb["nadir-delhi"]).toBe("efshar-hind");
  });
});
