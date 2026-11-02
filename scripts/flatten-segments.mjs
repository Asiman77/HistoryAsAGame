/**
 * Static export writes segment prefetch payloads as nested folders
 * (out/az/states/__next.$d$locale/states/__PAGE__.txt), while the client
 * router asks for one dot-joined file name
 * (/az/states/__next.$d$locale.states.__PAGE__.txt). On a plain static host
 * that request is a 404 and every <Link> click falls back to a full page
 * reload, which also cuts the theme crossfade between pages. This copies each
 * nested payload to the name the router requests. Run after `next build`.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) flatten(full, dir, entry.name);
    else walk(full);
  }
}

/** Every file under `segDir` becomes `<parent>/<segName>.<a>.<b>.txt`. */
function flatten(segDir, parent, segName) {
  const visit = (dir, parts) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, [...parts, entry.name]);
      else {
        const target = path.join(parent, [segName, ...parts, entry.name].join("."));
        if (!fs.existsSync(target)) {
          fs.copyFileSync(full, target);
          copied++;
        }
      }
    }
  };
  visit(segDir, []);
}

if (!fs.existsSync(root)) {
  console.error(`flatten-segments: ${root} tapılmadı`);
  process.exit(1);
}
walk(root);
console.log(`flatten-segments: ${copied} segment faylı router-in gözlədiyi adla kopyalandı`);
