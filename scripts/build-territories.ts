/**
 * Builds the political map snapshots served to the browser.
 *
 *   data/polities/<id>.json             polities (name, colour)
 *   data/territories/registry.json      regions (Voronoi seeds) and bbox
 *   data/territories/snapshots/*.json   which regions each polity holds in a given year
 *   data/territories/land.json          coastline mask (Natural Earth, public domain)
 *        ↓
 *   public/data/territories/<id>.json   one simplified GeoJSON per snapshot, fetched on demand
 *
 * Borders are hand-made approximations: each region is the Voronoi area around its
 * seed points, clipped to land. Run automatically before `dev` and `build`.
 */
import fs from "node:fs";
import path from "node:path";
import {
  area,
  booleanPointInPolygon,
  centerOfMass,
  featureCollection,
  intersect,
  point,
  pointOnFeature,
  simplify,
  truncate,
  union,
  voronoi,
} from "@turf/turf";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import {
  Polity,
  TerritoryRegistryFile,
  TerritorySnapshot,
  TerritorySnapshotSource,
} from "../src/domain/schema";

type Poly = Feature<Polygon | MultiPolygon>;
const dataDir = path.join(process.cwd(), "data", "territories");
const outDir = path.join(process.cwd(), "public", "data", "territories");

export function buildTerritories(): TerritorySnapshot[] {
  const registry = TerritoryRegistryFile.parse(JSON.parse(fs.readFileSync(path.join(dataDir, "registry.json"), "utf8")));
  const land = JSON.parse(fs.readFileSync(path.join(dataDir, "land.json"), "utf8")) as Poly;
  const countries = (
    JSON.parse(fs.readFileSync(path.join(dataDir, "countries.json"), "utf8")) as { countries: Record<string, Poly["geometry"]> }
  ).countries;
  const polityDir = path.join(process.cwd(), "data", "polities");
  const polities = new Map(
    fs
      .readdirSync(polityDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => Polity.parse(JSON.parse(fs.readFileSync(path.join(polityDir, f), "utf8"))))
      .map((p) => [p.id, p]),
  );

  // One Voronoi diagram over every seed, so neighbouring regions share edges exactly.
  const seeds = registry.regions.flatMap((r) => r.seeds.map((s) => point(s, { region: r.id })));
  const cells = voronoi(featureCollection(seeds), { bbox: registry.bbox });
  const cellsByRegion = new Map<string, Feature<Polygon>[]>();
  cells.features.forEach((cell, i) => {
    if (!cell) return;
    const region = seeds[i]!.properties.region as string;
    cellsByRegion.set(region, [...(cellsByRegion.get(region) ?? []), cell]);
  });

  const files = fs.readdirSync(path.join(dataDir, "snapshots")).filter((f) => f.endsWith(".json")).sort();
  const built: TerritorySnapshot[] = [];
  for (const file of files) {
    const src = TerritorySnapshotSource.parse(JSON.parse(fs.readFileSync(path.join(dataDir, "snapshots", file), "utf8")));
    const out: TerritorySnapshot = {
      id: src.id,
      year: src.year,
      title: src.title,
      certainty: src.certainty,
      ...(src.note ? { note: src.note } : {}),
      sources: src.sources,
      polities: src.polities.map((p) => {
        const meta = polities.get(p.polityId);
        if (!meta) throw new Error(`${file}: naməlum polity ${p.polityId}`);
        if (p.iso) {
          const g = countries[p.iso];
          if (!g) throw new Error(`${file}: naməlum ölkə ${p.iso}`);
          const f: Poly = { type: "Feature", properties: {}, geometry: g };
          return {
            id: p.polityId,
            name: p.name ?? meta.name,
            color: meta.color,
            geometry: g,
            ...(p.capitalId ? { capitalId: p.capitalId } : {}),
            ...(p.vassalOf ? { vassalOf: p.vassalOf } : {}),
            labelAt: p.labelAt ?? labelPoint(f),
            areaKm2: Math.round(area(f) / 1e10) * 1e4,
          };
        }
        const parts = p.regions!.flatMap((g) => registry.groups?.[g] ?? [g]).flatMap((r) => {
          const c = cellsByRegion.get(r);
          if (!c) throw new Error(`${file}: naməlum region ${r}`);
          return c;
        });
        const merged = parts.length === 1 ? parts[0]! : (union(featureCollection(parts)) as Poly);
        const onLand = intersect(featureCollection([merged as Poly, land])) as Poly | null;
        if (!onLand) throw new Error(`${file}: ${p.polityId} qurudan kənardadır`);
        const geometry = truncate(simplify(onLand, { tolerance: 0.015, highQuality: true }), { precision: 3 }) as Poly;
        return {
          id: p.polityId,
          name: p.name ?? meta.name,
          color: meta.color,
          geometry: geometry.geometry,
          ...(p.capitalId ? { capitalId: p.capitalId } : {}),
          ...(p.vassalOf ? { vassalOf: p.vassalOf } : {}),
          labelAt: p.labelAt ?? labelPoint(geometry),
          // Area of our approximate polygon, rounded to 10 000 km²: shown as "təxmini".
          areaKm2: Math.round(area(onLand) / 1e10) * 1e4,
        };
      }),
    };
    built.push(TerritorySnapshot.parse(out));
  }
  return built;
}

/** A point inside the largest part, near its centre of mass. */
function labelPoint(f: Poly): [number, number] {
  const polys: Position[][][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const largest = polys
    .map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } }) as Feature<Polygon>)
    .sort((a, b) => area(b) - area(a))[0]!;
  const c = centerOfMass(largest);
  const p = booleanPointInPolygon(c, largest) ? c : pointOnFeature(largest);
  const [lng, lat] = p.geometry.coordinates as [number, number];
  return [Math.round(lng * 100) / 100, Math.round(lat * 100) / 100];
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "build-territories.ts"))) {
  const started = Date.now();
  const snapshots = buildTerritories();
  fs.mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  for (const s of snapshots) {
    const text = JSON.stringify(s);
    bytes += text.length;
    fs.writeFileSync(path.join(outDir, `${s.id}.json`), text);
  }
  console.log(
    `territories → public/data/territories/: ${snapshots.length} snapshot, ${(bytes / 1024).toFixed(0)} KB, ${Date.now() - started} ms`,
  );
}
