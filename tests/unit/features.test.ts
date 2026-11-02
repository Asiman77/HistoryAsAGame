import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MOODS, type Place, type WorldEvent } from "@/domain/schema";
import { AMBIENCE_LAYERS, AUDIO_SPRITE, MOOD_SOUND, MUSIC_LAYERS } from "@/features/audio/manifest";
import { headingDeg } from "@/features/map/battle";
import { tokenizeGlossary, lowerAz } from "@/lib/glossary";
import { MOOD_STYLES } from "@/lib/mood";
import { activeCueIndex } from "@/lib/narration";
import { isPlaceVisibleIn, matchPlace, placeNameIn } from "@/lib/places";
import { pickSnapshotId } from "@/lib/territory";
import { pickWorldEvents } from "@/lib/worldContext";

describe("pickSnapshotId", () => {
  const snaps = [
    { id: "y1440", year: 1440 },
    { id: "y1501", year: 1501 },
    { id: "y1520", year: 1520 },
    { id: "y1700", year: 1700 },
  ];
  it("uses the latest snapshot not after the year", () => {
    expect(pickSnapshotId(1514, snaps)).toBe("y1501");
    expect(pickSnapshotId(1520, snaps)).toBe("y1520");
  });
  it("never jumps a century back: falls back to the nearest one", () => {
    expect(pickSnapshotId(1688, snaps)).toBe("y1700");
    expect(pickSnapshotId(1425, snaps)).toBe("y1440");
  });
  it("honours an explicit override that exists", () => {
    expect(pickSnapshotId(1501, snaps, "y1440")).toBe("y1440");
    expect(pickSnapshotId(1501, snaps, "nope")).toBe("y1501");
  });
  it("returns null without snapshots", () => {
    expect(pickSnapshotId(1500, [])).toBeNull();
  });
});

describe("places", () => {
  const istanbul: Place = {
    id: "istanbul",
    names: { historical: { az: "İstanbul" } },
    lat: 41.0136,
    lng: 28.955,
    type: "port",
    importance: 1,
    periods: [
      { from: 1400, to: 1452, name: { az: "Konstantinopol" } },
      { from: 1453, to: 1800 },
    ],
    description: { az: "x" },
  };
  const chaldiran: Place = { ...istanbul, id: "chaldiran", type: "battlefield", lat: 39.07, lng: 44.35, periods: [{ from: 1514, to: 1800 }] };

  it("names a place by period", () => {
    expect(placeNameIn(istanbul, 1440).az).toBe("Konstantinopol");
    expect(placeNameIn(istanbul, 1500).az).toBe("İstanbul");
  });
  it("hides battlefields before their battle", () => {
    expect(isPlaceVisibleIn(chaldiran, 1510)).toBe(false);
    expect(isPlaceVisibleIn(chaldiran, 1514)).toBe(true);
  });
  it("matches event locations within 30 km, or by explicit id", () => {
    const loc = { name: { az: "Çaldıran düzü" }, lat: 39.1, lng: 44.3 };
    expect(matchPlace(loc, [istanbul, chaldiran])?.id).toBe("chaldiran");
    expect(matchPlace({ ...loc, lat: 40.5 }, [istanbul, chaldiran])).toBeNull();
    expect(matchPlace({ ...loc, placeId: "istanbul" }, [istanbul, chaldiran])?.id).toBe("istanbul");
  });
});

describe("pickWorldEvents", () => {
  const ev = (id: string, year: number, region: WorldEvent["region"], endYear?: number): WorldEvent => ({
    id,
    year,
    ...(endYear ? { endYear } : {}),
    region,
    title: { az: id },
    description: { az: id },
    sources: [{ title: "x", type: "web" }],
  });
  const all = [ev("a", 1514, "europe"), ev("b", 1513, "europe"), ev("c", 1517, "middle-east"), ev("d", 1492, "americas"), ev("e", 1508, "europe", 1512)];

  it("keeps to ±12 years and sorts by year", () => {
    const picked = pickWorldEvents(1514, all);
    expect(picked.map((e) => e.id)).not.toContain("d");
    expect(picked.map((e) => e.year)).toEqual([...picked.map((e) => e.year)].sort((x, y) => x - y));
  });
  it("prefers different regions", () => {
    const regions = new Set(pickWorldEvents(1514, all).map((e) => e.region));
    expect(regions.size).toBeGreaterThan(1);
  });
  it("treats a span containing the year as distance 0", () => {
    expect(pickWorldEvents(1510, [ev("e", 1508, "europe", 1512), ev("f", 1500, "asia")], 1)[0]!.id).toBe("e");
  });
});

describe("tokenizeGlossary", () => {
  const terms = [
    { id: "qizilbash", forms: ["qızılbaş"] },
    { id: "mirze", forms: ["mirzə"] },
    { id: "sultan", forms: ["sultan"] },
  ];
  it("marks Azerbaijani inflections and only the first occurrence", () => {
    const seg = tokenizeGlossary("Qızılbaşların başçısı qızılbaş idi.", terms);
    expect(seg.filter((s) => s.termId).map((s) => s.text)).toEqual(["Qızılbaşların"]);
    expect(seg.map((s) => s.text).join("")).toBe("Qızılbaşların başçısı qızılbaş idi.");
  });
  it("does not match a stem inside another word", () => {
    expect(tokenizeGlossary("sultanzadə", terms).some((s) => s.termId)).toBe(false);
    expect(tokenizeGlossary("Əli Mirzəni", terms).find((s) => s.termId)?.text).toBe("Mirzəni");
  });
  it("lower-cases dotted and dotless I the Azerbaijani way", () => {
    expect(lowerAz("İSMAYIL")).toBe("ismayıl");
  });
});

describe("activeCueIndex", () => {
  const cues = [
    { start: 0, end: 2 },
    { start: 2.5, end: 5 },
    { start: 5, end: 8 },
  ];
  it("finds the cue playing at a time, or -1 in gaps", () => {
    expect(activeCueIndex(cues, 1)).toBe(0);
    expect(activeCueIndex(cues, 2.2)).toBe(-1);
    expect(activeCueIndex(cues, 5)).toBe(2);
    expect(activeCueIndex(cues, 9)).toBe(-1);
  });
});

describe("mood system", () => {
  it("defines a look and a sound for every mood", () => {
    for (const mood of MOODS) {
      expect(MOOD_STYLES[mood]).toBeDefined();
      expect(MOOD_SOUND[mood].music.length).toBeGreaterThan(0);
    }
  });
  it("follows the brief: battle → nağara/zurna, peace → tar/kamança, death → balaban", () => {
    expect(MOOD_SOUND.battle.music).toContain("battle");
    expect(MOOD_SOUND.peace.music).toContain("peace");
    expect(MOOD_SOUND.death.music).toContain("balaban");
  });
  it("ships every audio file in both formats", () => {
    const files = [
      ...Object.values(MUSIC_LAYERS).map((l) => l.file),
      ...Object.values(AMBIENCE_LAYERS).map((l) => l.file),
      AUDIO_SPRITE.file,
    ];
    for (const f of files)
      for (const ext of ["webm", "mp3"]) expect(fs.existsSync(path.join("public", "audio", `${f}.${ext}`)), `${f}.${ext}`).toBe(true);
  });
  it("lists every audio file in docs/AUDIO_CREDITS.md", () => {
    const credits = fs.readFileSync("docs/AUDIO_CREDITS.md", "utf8");
    for (const f of fs.readdirSync(path.join("public", "audio"))) expect(credits, f).toContain(f.replace(/\.(webm|mp3)$/, ""));
  });
});

describe("battle arrows", () => {
  it("computes screen headings clockwise from north", () => {
    expect(headingDeg([44, 39], [44, 40])).toBeCloseTo(0);
    expect(headingDeg([44, 39], [45, 39])).toBeCloseTo(90);
    expect(headingDeg([44, 39], [43, 39])).toBeCloseTo(-90);
  });
});
