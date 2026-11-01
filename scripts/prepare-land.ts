/**
 * One-off: builds data/territories/land.json (the coastline mask for the political map)
 * from Natural Earth 1:50m land and lakes (public domain).
 *
 *   npx tsx scripts/prepare-land.ts <ne_50m_land.geojson> <ne_50m_lakes.geojson>
 *
 * Download both from https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
 */
import fs from "node:fs";
import path from "node:path";
import { area, bboxClip, difference, featureCollection, simplify, truncate, union } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { TerritoryRegistryFile } from "../src/domain/schema";

const [landFile, lakesFile] = process.argv.slice(2);
if (!landFile || !lakesFile) throw new Error("usage: prepare-land.ts <land.geojson> <lakes.geojson>");

const registry = TerritoryRegistryFile.parse(
  JSON.parse(fs.readFileSync(path.join("data", "territories", "registry.json"), "utf8")),
);
const bbox = registry.bbox;
type Poly = Feature<Polygon | MultiPolygon>;
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")) as { features: Poly[] };

const clipped = read(landFile)
  .features.map((f) => bboxClip(f, bbox) as Poly)
  .filter((f) => f.geometry.coordinates.length > 0 && area(f) > 5e7);
let land = union(featureCollection(clipped)) as Poly;

// Large inland lakes the borders should not cover. The Caspian is already a hole in the land layer.
const LAKES = /Urmia|Van$|Sevan|Aral/;
for (const lake of read(lakesFile).features) {
  if (!LAKES.test(String((lake.properties as { name?: string })?.name ?? ""))) continue;
  land = (difference(featureCollection([land, lake])) as Poly) ?? land;
}

land = truncate(simplify(land, { tolerance: 0.02, highQuality: true }), { precision: 3 }) as Poly;
land.properties = {
  source: "Natural Earth 1:50m land and lakes, public domain (naturalearthdata.com)",
};
const out = path.join("data", "territories", "land.json");
fs.writeFileSync(out, JSON.stringify(land));
console.log(`${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
