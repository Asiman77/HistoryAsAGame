/**
 * One-off: extracts present-day countries for the 2020 map from Natural Earth
 * 1:50m admin-0 (public domain) into data/territories/countries.json.
 * Natural Earth draws Azerbaijan within its internationally recognised borders.
 *
 *   npx tsx scripts/prepare-countries.ts <ne_50m_admin_0_countries.geojson>
 */
import fs from "node:fs";
import path from "node:path";
import { bboxClip, simplify, truncate } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

const ISO = ["AZE", "ARM", "GEO", "IRN", "TUR", "RUS"];
const BBOX: [number, number, number, number] = [16, 18, 82, 50];
const src = JSON.parse(fs.readFileSync(process.argv[2]!, "utf8")) as { features: Feature<Polygon | MultiPolygon>[] };
const out: Record<string, Polygon | MultiPolygon> = {};
for (const iso of ISO) {
  const f = src.features.find((x) => x.properties?.ADM0_A3 === iso);
  if (!f) throw new Error(`missing ${iso}`);
  const g = truncate(simplify(bboxClip(f, BBOX) as Feature<Polygon | MultiPolygon>, { tolerance: 0.01, highQuality: true }), { precision: 3 });
  out[iso] = g.geometry;
}
const file = path.join("data", "territories", "countries.json");
fs.writeFileSync(file, JSON.stringify({ source: "Natural Earth 1:50m admin-0 countries, public domain", countries: out }));
console.log(`${file}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
