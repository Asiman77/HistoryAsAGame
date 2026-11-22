/**
 * One-off: extracts present-day countries for the 2020 map from Natural Earth
 * 1:50m admin-0 (public domain) into data/territories/countries.json.
 * Natural Earth draws Azerbaijan within its internationally recognised borders.
 *
 *   npx tsx scripts/prepare-countries.ts <ne_50m_admin_0_countries.geojson>
 */
import fs from "node:fs";
import path from "node:path";
import { area, bboxPolygon, featureCollection, intersect, multiPolygon, polygon, simplify, truncate, unkinkPolygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

const ISO = ["AZE", "ARM", "GEO", "IRN", "TUR", "RUS"];
const BBOX: [number, number, number, number] = [16, 18, 82, 50];
const src = JSON.parse(fs.readFileSync(process.argv[2]!, "utf8")) as { features: Feature<Polygon | MultiPolygon>[] };
const out: Record<string, Polygon | MultiPolygon> = {};
for (const iso of ISO) {
  const f = src.features.find((x) => x.properties?.ADM0_A3 === iso);
  if (!f) throw new Error(`missing ${iso}`);
  // A polygon clip, not bboxClip: Sutherland–Hodgman leaves a concave country (Russia at 50° N)
  // with edges running back along the clip line, a ring PostGIS rejects as self-intersecting.
  const clipped = intersect(featureCollection<Polygon | MultiPolygon>([f, bboxPolygon(BBOX)]))!;
  const g = truncate(simplify(clipped, { tolerance: 0.01, highQuality: true }), { precision: 3 });
  out[iso] = valid(g.geometry);
}

/** Simplifying can make a ring touch itself: split it at the kinks and merge the parts again. */
function valid(g: Polygon | MultiPolygon): Polygon | MultiPolygon {
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).filter((p) => p.length);
  const parts = polys.flatMap((p) => unkinkPolygon(polygon(p)).features.filter((x) => area(x) > 1e6).map((x) => x.geometry.coordinates));
  const merged = intersect(featureCollection<Polygon | MultiPolygon>([multiPolygon(parts), bboxPolygon(BBOX)]))!;
  return truncate(merged, { precision: 3 }).geometry;
}

const file = path.join("data", "territories", "countries.json");
fs.writeFileSync(file, JSON.stringify({ source: "Natural Earth 1:50m admin-0 countries, public domain", countries: out }));
console.log(`${file}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
