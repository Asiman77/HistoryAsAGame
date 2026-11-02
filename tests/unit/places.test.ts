import { describe, expect, it } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import type { TerritorySnapshot } from "@/domain/schema";
import { eventsAtPlace } from "@/lib/historyIndex";
import { clipToLifetime, placeMembership, SNAPSHOT_REACH_YEARS } from "@/lib/placeHistory";

const square = (x: number, y: number, s = 1) => ({
  type: "Polygon" as const,
  coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});
const snap = (year: number, owner: string, capitalId?: string): TerritorySnapshot => ({
  id: `y${year}`,
  year,
  title: { az: String(year) },
  certainty: "approximate",
  sources: [],
  polities: [
    { id: owner, name: { az: owner }, color: "#123456", geometry: square(0, 0), labelAt: [0.5, 0.5], ...(capitalId ? { capitalId } : {}) },
    { id: "elsewhere", name: { az: "x" }, color: "#654321", geometry: square(5, 5), labelAt: [5.5, 5.5] },
  ],
});

describe("placeMembership", () => {
  it("merges consecutive snapshots of the same owner and marks capitals", () => {
    const spans = placeMembership("city", [0.5, 0.5], [snap(1500, "a"), snap(1510, "a"), snap(1520, "b", "city")]);
    expect(spans).toEqual([
      expect.objectContaining({ kind: "polity", polityId: "a", from: 1500, to: 1519, capital: false }),
      expect.objectContaining({ kind: "polity", polityId: "b", from: 1520, to: 1520, capital: true }),
    ]);
  });
  it("never stretches a snapshot over a long silence: the rest is a gap", () => {
    const spans = placeMembership("city", [0.5, 0.5], [snap(1700, "a"), snap(1900, "b")]);
    expect(spans[0]).toMatchObject({ polityId: "a", to: 1700 + SNAPSHOT_REACH_YEARS });
    expect(spans[1]).toEqual({ kind: "gap", from: 1700 + SNAPSHOT_REACH_YEARS + 1, to: 1899 });
  });
  it("leaves out snapshots where the point is outside every drawn polity", () => {
    expect(placeMembership("city", [3, 3], [snap(1500, "a")])).toEqual([]);
  });
  it("clips to the years the place existed and drops edge gaps", () => {
    const spans = placeMembership("city", [0.5, 0.5], [snap(1440, "a"), snap(1740, "b"), snap(1760, "c")]);
    const clipped = clipToLifetime(spans, [{ from: 1752, to: 2025 }]);
    expect(clipped).toEqual([
      expect.objectContaining({ polityId: "b", from: 1752, to: 1759 }),
      expect.objectContaining({ polityId: "c", from: 1760, to: 1760 }),
    ]);
  });
});

describe("history index", async () => {
  const index = await new FileSystemRepository().getHistoryIndex();
  it("is chronological and covers every category", () => {
    const years = index.map((e) => e.date.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(new Set(index.map((e) => e.category))).toEqual(new Set(["person", "state", "battle"]));
  });
  it("pins a war day on a place only by name, not by a 30 km radius", () => {
    const shusha = eventsAtPlace(index, "shusha").filter((e) => e.entityType === "conflict").map((e) => e.stepId);
    expect(shusha).toEqual(["2020-11-08"]);
  });
  it("Təbriz gathers steps of several entities with deep links", () => {
    const tebriz = eventsAtPlace(index, "tebriz");
    expect(new Set(tebriz.map((e) => e.entityId)).size).toBeGreaterThan(1);
    for (const e of tebriz) expect(e.href).toMatch(/\?step=/);
  });
});
