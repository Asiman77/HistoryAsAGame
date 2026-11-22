/**
 * Backend parity check for the geo and chronology queries (backend phase 9).
 *
 * Runs the frontend's own functions over data/ and compares them with a running backend
 * that has the same data imported:
 *   npx tsx scripts/parity-history-queries.ts http://localhost:8080
 *
 * Compared: the events of every place (eventsAtPlace) and who held it (placeMembership +
 * clipToLifetime); "Tarixdə bu gün" for every day of the year; and for every slider year the
 * snapshot pick, the living persons with age and position, the year's events and the reigns;
 * the "meanwhile in the world" pick of every slider year (/world-events?year=);
 * and /compare for every ordered pair of simulations (lanes, battles, overlap, meetings).
 * Exits with 1 and lists the differences when anything differs.
 */
import { getRepository } from "@/data";
import { eventsAtPlace } from "@/lib/historyIndex";
import { onThisDay } from "@/lib/onThisDay";
import { clipToLifetime, placeMembership } from "@/lib/placeHistory";
import { eventsInYear, personsInYear, reignsInYear, snapshotForYear, SLIDER_FROM, SLIDER_TO } from "@/lib/timeSlider";
import { loadTimeExplorerData } from "@/data/timeExplorer";
import type { TerritorySnapshot } from "@/domain/schema";
import { loadCompareData } from "@/data/compare";
import { compareLanes } from "@/lib/compare";
import { pickWorldEvents } from "@/lib/worldContext";

const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/$/, "") + "/api/v1";
const differences: string[] = [];

async function get(path: string): Promise<any> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function same(what: string, frontend: unknown, backend: unknown) {
  const f = JSON.stringify(frontend);
  const b = JSON.stringify(backend);
  if (f !== b) differences.push(`${what}\n    frontend: ${f}\n    backend:  ${b}`);
}

const keyOf = (e: { key?: string }) => e.key;

async function main() {
  const repo = getRepository();
  const [places, index, snapshotMetas, eras] = await Promise.all([
    repo.listPlaces(),
    repo.getHistoryIndex(),
    repo.listTerritorySnapshots(),
    repo.listEras(),
  ]);
  // The backend leaves out snapshots that cannot be published (y2020: invalid polygon, ADR-0013).
  const snapshots = (await Promise.all(snapshotMetas.map((s) => repo.getTerritorySnapshot(s.id))))
    .filter((s): s is TerritorySnapshot => s !== null);
  const drafts = await draftSnapshots(snapshots.map((s) => s.id));
  const usable = snapshots.filter((s) => !drafts.has(s.id));

  // --- places -----------------------------------------------------------------------------
  for (const place of places) {
    const res = await get(`/places/${place.id}/timeline`);
    same(`place ${place.id}: events`, eventsAtPlace(index, place.id).map(keyOf), res.events.map(keyOf));
    const spans = clipToLifetime(placeMembership(place.id, [place.lng, place.lat], usable), place.periods);
    same(
      `place ${place.id}: membership`,
      spans.map((s) => (s.kind === "gap" ? `gap ${s.from}-${s.to}` : `${s.polityId} ${s.from}-${s.to}${s.capital ? " capital" : ""}`)),
      res.membership.map((s: any) => (s.kind === "GAP" ? `gap ${s.fromYear}-${s.toYear}` : `${s.polity} ${s.fromYear}-${s.toYear}${s.capital ? " capital" : ""}`)),
    );
  }

  // --- on this day ------------------------------------------------------------------------
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= days[month - 1]!; day++) {
      const f = onThisDay(index, { month, day });
      const b = await get(`/on-this-day?month=${month}&day=${day}`);
      same(`on-this-day ${month}-${day}`, { mode: f.mode.toUpperCase(), events: f.events.map(keyOf) }, { mode: b.mode, events: b.events.map(keyOf) });
    }
  }

  // --- slider years -----------------------------------------------------------------------
  const explorer = await loadTimeExplorerData(repo);
  const worldEvents = await repo.listWorldEvents();
  const usableMetas = snapshotMetas.filter((s) => usable.some((u) => u.id === s.id));
  for (let year = SLIDER_FROM; year <= SLIDER_TO; year++) {
    const b = await get(`/timeline?year=${year}`);
    const pick = snapshotForYear(year, usableMetas);
    same(`timeline ${year}: map`, pick, { id: b.map.snapshot, covered: b.map.covered, prevYear: b.map.prevYear, nextYear: b.map.nextYear });
    same(
      `timeline ${year}: persons`,
      personsInYear(year, explorer.persons).map((p) => [p.person.id, p.age, p.approximate, p.lat, p.lng]),
      b.persons.map((p: any) => [p.slug, p.age, p.ageApproximate, p.lat, p.lng]),
    );
    same(`timeline ${year}: events`, eventsInYear(year, index).map(keyOf), b.events.map(keyOf));
    same(
      `timeline ${year}: reigns`,
      reignsInYear(year, explorer.political.reigns).map((r) => `${r.polityId}/${r.rulerId}`).sort(),
      b.rulers.map((r: any) => `${r.polity}/${r.ruler.slug}`).sort(),
    );
    same(`world-events ${year}`, pickWorldEvents(year, worldEvents).map((e) => e.id),
      (await get(`/world-events?year=${year}`)).items.map((e: any) => e.slug));
    const era = eras.filter((e) => year >= e.startYear && year <= e.endYear).sort((a, c) => c.startYear - a.startYear)[0];
    same(`timeline ${year}: era`, era?.id ?? null, b.era?.slug ?? null);
  }

  // --- compare ----------------------------------------------------------------------------
  const compare = await loadCompareData(repo);
  let pairs = 0;
  for (const x of compare.owners) {
    for (const y of compare.owners) {
      if (x === y) continue;
      pairs++;
      const b = await get(`/compare?a=${x.type}:${x.id}&b=${y.type}:${y.id}`);
      const what = `compare ${x.type}:${x.id} / ${y.type}:${y.id}`;
      for (const [lane, res] of [[x, b.a], [y, b.b]] as const)
        same(`${what}: lane ${lane.id}`, lane.events.map((e) => [e.key, e.battles]), res.events.map((e: any) => [e.key, e.battles]));
      const f = compareLanes(x, y);
      same(`${what}: overlap`, f.overlap, b.overlap ? { from: b.overlap.fromYear, to: b.overlap.toYear } : null);
      same(
        `${what}: meetings`,
        f.meetings.map((m) => [m.reasons.map((r) => r.toUpperCase()), m.a, m.b, m.year, m.placeId, m.distanceKm, m.battle]),
        b.intersections.map((i: any) => [i.reasons, i.a, i.b, i.year, i.place, i.distanceKm, i.battle?.slug ?? null]),
      );
    }
  }

  if (differences.length) {
    console.error(`${differences.length} difference(s):\n` + differences.slice(0, 50).join("\n"));
    process.exit(1);
  }
  console.log(`parity OK: ${places.length} places, 366 days, ${SLIDER_TO - SLIDER_FROM + 1} years, ${pairs} compare pairs`);
}

/** Snapshots the backend did not publish: their year never comes back from /territories. */
async function draftSnapshots(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (const id of ids) {
    const year = Number(id.replace(/^y/, ""));
    const res = await get(`/territories?year=${year}`);
    if (res.snapshot?.slug !== id) out.add(id);
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
