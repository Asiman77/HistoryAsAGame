// MapLibre v6 loads its worker as a separate ES module next to the main
// bundle. Bundlers do not emit it, so we serve a copy from public/ that
// always matches the installed library version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("maplibre-gl/package.json"));
const target = path.join(process.cwd(), "public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(path.join(pkgDir, "dist", "maplibre-gl-worker.mjs"), path.join(target, "maplibre-gl-worker.mjs"));
console.log("maplibre worker → public/vendor/maplibre-gl-worker.mjs");
