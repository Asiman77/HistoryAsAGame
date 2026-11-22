import { describe, expect, it } from "vitest";
import { FileSystemRepository } from "@/data/fileSystemRepository";
import { loadCompareData } from "@/data/compare";
import { resolvePair } from "@/features/compare/ComparePageClient";
import { axisRange, compareLanes, meetings, overlap, parseOwner, sharedPlaces, type Lane, type LaneEvent } from "@/lib/compare";
import { getMessages } from "@/lib/i18n";

const ev = (stepId: string, year: number, placeId: string | null, lat: number, lng: number, battles: string[] = []): LaneEvent => ({
  key: `person:x:${stepId}`,
  stepId,
  title: { az: stepId },
  date: { year, certainty: "exact" },
  placeId,
  lat,
  lng,
  icon: "journey",
  mood: "peace",
  claimType: "fact",
  themeId: "default",
  href: `/persons/x/?step=${stepId}`,
  battles,
});
const lane = (...events: LaneEvent[]): Lane => ({
  type: "person",
  id: "x",
  title: { az: "x" },
  fromYear: events[0]?.date.year ?? null,
  toYear: events.at(-1)?.date.year ?? null,
  events,
  path: [],
});

// The same cases as the backend's HistoryRulesTests (CompareReader), so both sides agree.
describe("compare rules (backend parity)", () => {
  it("takes type:slug, and a bare slug as a person", () => {
    expect(parseOwner("person:shah-ismayil")).toEqual({ type: "person", id: "shah-ismayil" });
    expect(parseOwner(" state:afshar ")).toEqual({ type: "state", id: "afshar" });
    expect(parseOwner("uzun-hasan")).toEqual({ type: "person", id: "uzun-hasan" });
    for (const bad of ["", "place:tebriz", "person:", "a:b:c", "Şah"]) expect(parseOwner(bad), bad).toBeNull();
  });

  it("steps meet at the same place or within 25 km in the same year", () => {
    const a = lane(ev("a1", 1514, "tebriz", 38.08, 46.29), ev("a2", 1520, null, 40.0, 45.0));
    const b = lane(
      ev("b1", 1514, "tebriz", 38.3, 46.29), // same place, 24 km away
      ev("b2", 1515, "tebriz", 38.08, 46.29), // same place, another year
      ev("b3", 1520, null, 40.2, 45.0), // no place, 22 km away
    );
    const met = meetings(a, b);
    expect(met.map((x) => `${x.a}/${x.b}`)).toEqual(["a1/b1", "a2/b3"]);
    expect(met[0]!.placeId).toBe("tebriz");
    expect(met[1]!.placeId).toBeNull();
    expect(met[1]!.distanceKm).toBeLessThan(25);
    expect(meetings(a, lane(ev("c1", 1520, null, 40.3, 45.0)))).toEqual([]); // 33 km
  });

  it("a shared battle meets whatever the year and is listed once with the place", () => {
    const a = lane(ev("a1", 1738, "kandahar", 31.6, 65.7, ["kandahar-1738"]));
    const b = lane(ev("b1", 1738, "kandahar", 31.6, 65.7, ["kandahar-1738"]), ev("b2", 1740, null, 0, 0, ["kandahar-1738"]));
    const met = meetings(a, b);
    expect(met.map((x) => x.reasons)).toEqual([["place", "battle"], ["battle"]]);
    expect(met[1]!.battle).toBe("kandahar-1738");
  });

  it("lanes overlap only when their years do", () => {
    const a = lane(ev("a1", 1425, null, 0, 0), ev("a2", 1478, null, 0, 0));
    const b = lane(ev("b1", 1487, null, 0, 0), ev("b2", 1524, null, 0, 0));
    const c = lane(ev("c1", 1470, null, 0, 0), ev("c2", 1490, null, 0, 0));
    expect(overlap(a, b)).toBeNull();
    expect(overlap(a, c)).toEqual({ from: 1470, to: 1478 });
  });
});

describe("shared places and axis", () => {
  it("lists places both visit in other years, leaving out visits that are already meetings", () => {
    const a = lane(ev("a1", 1468, "tebriz", 38.08, 46.29), ev("a2", 1514, "tebriz", 38.08, 46.29), ev("a3", 1470, "amid", 37.9, 40.2));
    const b = lane(ev("b1", 1501, "tebriz", 38.08, 46.29), ev("b2", 1514, "tebriz", 38.08, 46.29));
    const met = meetings(a, b);
    expect(met.map((x) => `${x.a}/${x.b}`)).toEqual(["a2/b2"]);
    expect(sharedPlaces(a, b, met)).toEqual([{ placeId: "tebriz", a: [{ stepId: "a1", year: 1468 }], b: [{ stepId: "b1", year: 1501 }] }]);
  });

  it("pads the shared axis to whole decades", () => {
    expect(axisRange(lane(ev("a", 1425, null, 0, 0), ev("b", 1478, null, 0, 0)), lane(ev("c", 1487, null, 0, 0), ev("d", 1524, null, 0, 0)))).toEqual({
      from: 1420,
      to: 1530,
    });
  });
});

describe("compare page data", async () => {
  const data = await loadCompareData(new FileSystemRepository());
  const m = getMessages("az");
  const owner = (key: string) => data.owners.find((o) => `${o.type}:${o.id}` === key)!;

  it("offers every simulation with steps, persons, states and wars alike", () => {
    expect(data.owners.map((o) => `${o.type}:${o.id}`)).toEqual(
      expect.arrayContaining(["person:uzun-hasan", "person:shah-ismayil", "person:nadir-shah", "state:afshar", "conflict:karabakh-war-2020"]),
    );
    for (const o of data.owners) {
      expect(o.fromYear).toBe(o.events[0]!.date.year);
      if (o.type === "conflict") expect(o.path).toEqual([]);
    }
    expect(owner("person:nadir-shah").path.length).toBeGreaterThan(owner("person:nadir-shah").events.length);
  });

  it("Uzun Həsən and Şah İsmayıl never meet but share Təbriz in other years", () => {
    const cmp = compareLanes(owner("person:uzun-hasan"), owner("person:shah-ismayil"));
    expect(cmp.overlap).toBeNull();
    expect(cmp.meetings).toEqual([]);
    expect(cmp.sharedPlaces.map((s) => s.placeId)).toContain("tebriz");
    expect(data.places.tebriz).toBeDefined();
  });

  it("a war day that is a battle carries it, and the battle has a name and link", () => {
    const shusha = owner("conflict:karabakh-war-2020").events.find((e) => e.battles.includes("shusha-2020"));
    expect(shusha).toBeDefined();
    expect(data.battles["shusha-2020"]!.href).toMatch(/^\/conflicts\/karabakh-war-2020\/\?step=/);
  });

  it("reads the pair from the URL and falls back with a notice", () => {
    expect(resolvePair(data.owners, null, null, m)).toMatchObject({ a: { id: "uzun-hasan" }, b: { id: "shah-ismayil" }, notice: null });
    expect(resolvePair(data.owners, "nadir-shah", "state:afshar", m)).toMatchObject({ a: { id: "nadir-shah" }, b: { id: "afshar" } });
    // Only a: the default rival.
    expect(resolvePair(data.owners, "person:shah-ismayil", null, m)).toMatchObject({ a: { id: "shah-ismayil" }, b: { id: "uzun-hasan" } });
    const unknown = resolvePair(data.owners, "person:nobody", null, m);
    expect(unknown.a.id).toBe("uzun-hasan");
    expect(unknown.notice).toContain("person:nobody");
    const same = resolvePair(data.owners, "person:nadir-shah", "person:nadir-shah", m);
    expect(same.b.id).not.toBe("nadir-shah");
    expect(same.notice).toBe(m.compare.same);
  });
});
