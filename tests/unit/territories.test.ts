import { describe, expect, it } from "vitest";
import { kinks, multiPolygon, polygon } from "@turf/turf";
import { buildTerritories } from "../../scripts/build-territories";

describe("territory snapshots", () => {
  const snapshots = buildTerritories();

  it("builds every snapshot with non-empty land geometry and a label inside the bbox", () => {
    expect(snapshots.length).toBeGreaterThan(5);
    for (const s of snapshots)
      for (const p of s.polities) {
        expect(p.geometry.coordinates.length, `${s.id}/${p.id}`).toBeGreaterThan(0);
        expect(p.labelAt[0]).toBeGreaterThan(16);
        expect(p.labelAt[0]).toBeLessThan(82);
      }
  });

  // The backend rejects a self-intersecting ring (PostGIS ST_IsValid) and leaves the snapshot unpublished.
  it("draws every polygon without self-intersections or empty parts", () => {
    for (const s of snapshots)
      for (const p of s.polities) {
        const g = p.geometry;
        const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
        expect(parts.every((x) => x.length > 0 && x.every((r) => r.length >= 4)), `${s.id}/${p.id}: empty part`).toBe(true);
        const f = g.type === "Polygon" ? polygon(g.coordinates) : multiPolygon(g.coordinates);
        expect(kinks(f).features.map((k) => k.geometry.coordinates), `${s.id}/${p.id}`).toEqual([]);
      }
  });

  it("shows the states named in the brief", () => {
    const ids = (year: number) => snapshots.find((s) => s.year === year)!.polities.map((p) => p.id);
    expect(ids(1468)).toEqual(expect.arrayContaining(["qaraqoyunlu", "agqoyunlu"]));
    expect(ids(1501)).toEqual(expect.arrayContaining(["safavid", "ottoman", "shirvan"]));
    expect(ids(1739)).toEqual(expect.arrayContaining(["afsharid", "mughal"]));
  });

  it("moves the Aq Qoyunlu capital from Amid to Tabriz", () => {
    const cap = (year: number) => snapshots.find((s) => s.year === year)!.polities.find((p) => p.id === "agqoyunlu")?.capitalId;
    expect(cap(1460)).toBe("amid");
    expect(cap(1472)).toBe("tebriz");
  });
}, 60_000);
