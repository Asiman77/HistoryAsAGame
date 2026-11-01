import { describe, expect, it } from "vitest";
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
