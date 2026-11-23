/**
 * Screenshots of built pages for phase reports (docs/FRONTEND_PLAN.md §12).
 *
 *   npm run build
 *   npx tsx scripts/page-screenshots.ts <out-dir> [--axe] [--mobile] /az/ /az/sexsiyyetler/ …
 *
 * Desktop is 1440×900, `--mobile` adds 390×844 (the design artboards).
 * `--axe` runs axe-core WCAG 2.2 AA rules on each page and exits non-zero on
 * violations. Serves out/ on a free port; nothing leaves the machine except
 * what the pages themselves load (map tiles, fonts are bundled).
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve("out");
const args = process.argv.slice(2);
const outDir = path.resolve(args[0] ?? "test-results/pages");
const axe = args.includes("--axe");
const mobile = args.includes("--mobile");
const paths = args.slice(1).filter((a) => !a.startsWith("--"));

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mjs": "text/javascript", ".mp3": "audio/mpeg", ".webm": "audio/webm" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

async function main() {
  if (!fs.existsSync(root)) throw new Error("out/ yoxdur: əvvəlcə npm run build");
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const profiles = [{ name: "desktop", options: { viewport: { width: 1440, height: 900 } } }, ...(mobile ? [{ name: "mobile", options: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } }] : [])];
  let violations = 0;
  for (const profile of profiles) {
    const context = await browser.newContext({ ...profile.options, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const p of paths) {
      await page.goto(`http://127.0.0.1:${port}${p}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const name = p.replace(/^\/|\/$/g, "").replace(/[/?=&]+/g, "_") || "root";
      const file = path.join(outDir, `${name}@${profile.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      if (axe) {
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        for (const v of result.violations) {
          violations++;
          console.log(`  axe ${v.id} (${v.impact}): ${v.nodes.length} element — ${v.help}`);
          for (const n of v.nodes.slice(0, 4)) console.log(`    ${n.target.join(" ")}`);
        }
      }
    }
    await context.close();
  }
  await browser.close();
  server.close();
  if (violations) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
