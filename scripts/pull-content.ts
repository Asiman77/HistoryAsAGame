/**
 * Fetches the backend's static export (docs/adr/0019) for an `api` build
 * (NEXT_PUBLIC_DATA_SOURCE=api, docs/adr/0020):
 *   - data/… → .content/data/  (the repository reads it there, src/data/index.ts)
 *   - public/data/territories/… → .content/public/data/territories/ (build-time lookups) and
 *     public/data/territories/ (served to the browser; generated, git-ignored)
 *
 *   CONTENT_URL=http://localhost:8333/public-content npm run content:pull   (the bucket: latest.json → v<N>/…)
 *   CONTENT_DIR=backend/target/static-export npm run content:pull           (an export folder on disk)
 */
import fs from "node:fs";
import path from "node:path";

export interface Manifest {
  contentVersion: number;
  prefix: string;
  files: string[];
}

const OUT = path.join(process.cwd(), ".content");
const TERRITORIES = path.join(process.cwd(), "public", "data", "territories");
const BUILT_PREFIX = "public/data/territories/";

/** Only paths the export can contain: no "..", no absolute paths, JSON only. */
export function safePath(p: string): boolean {
  return /^(data|public\/data\/territories)\/[a-z0-9_\-/.]+\.json$/i.test(p) && !p.split("/").includes("..");
}

async function fromUrl(base: string): Promise<{ version: number | null; files: Map<string, string> }> {
  const root = base.replace(/\/+$/, "");
  const res = await fetch(`${root}/latest.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${root}/latest.json: HTTP ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  const files = new Map<string, string>();
  const queue = manifest.files.filter(safePath);
  const workers = Array.from({ length: 8 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const r = await fetch(`${root}/${manifest.prefix}${f}`);
      if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
      files.set(f, await r.text());
    }
  });
  await Promise.all(workers);
  return { version: manifest.contentVersion, files };
}

function fromDir(dir: string): { version: number | null; files: Map<string, string> } {
  const files = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        const rel = path.relative(dir, full).split(path.sep).join("/");
        if (safePath(rel)) files.set(rel, fs.readFileSync(full, "utf8"));
      }
    }
  };
  walk(dir);
  return { version: null, files };
}

async function main() {
  const url = process.env.CONTENT_URL;
  const dir = process.env.CONTENT_DIR;
  if (!url && !dir) throw new Error("CONTENT_URL (the public-content bucket) or CONTENT_DIR (an export folder) is required");
  const { version, files } = url ? await fromUrl(url) : fromDir(path.resolve(dir!));
  if (![...files.keys()].some((f) => f.startsWith("data/"))) throw new Error("the export has no data/ files");

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.rmSync(TERRITORIES, { recursive: true, force: true });
  fs.mkdirSync(TERRITORIES, { recursive: true });
  for (const [f, body] of files) {
    JSON.parse(body); // fail early on a broken file
    // Built polygons: next to the data for the repository (build-time lookups), and in public/ for the browser.
    const targets = f.startsWith(BUILT_PREFIX) ? [path.join(OUT, f), path.join(TERRITORIES, f.slice(BUILT_PREFIX.length))] : [path.join(OUT, f)];
    for (const target of targets) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
    }
  }
  fs.writeFileSync(path.join(OUT, "pulled.json"), JSON.stringify({ source: url ?? dir, contentVersion: version, files: files.size }, null, 2));
  console.log(`✓ ${files.size} fayl çəkildi (content_version ${version ?? "?"}) → .content/data, public/data/territories`);
}

// Run only as a script (the unit test imports safePath).
if (process.argv[1] && path.basename(process.argv[1]).startsWith("pull-content")) {
  main().catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
