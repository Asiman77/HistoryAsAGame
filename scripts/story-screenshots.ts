/**
 * Screenshots of Storybook stories for phase reports (docs/FRONTEND_PLAN.md §12).
 *
 *   npm run build-storybook
 *   npx tsx scripts/story-screenshots.ts <out-dir> [--axe] [story-id[@theme] ...]
 *
 * Without ids every story is shot in the default theme. `@theme` picks a
 * period theme (data/themes id), e.g. `ds-surfaces--panels@sefevi`.
 * `--axe` also runs axe-core (WCAG 2.2 AA rules) on each story and exits
 * non-zero when it finds violations.
 * Serves storybook-static/ on a free port; nothing leaves the machine.
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve("storybook-static");
const out = path.resolve(process.argv[2] ?? "test-results/stories");
const axe = process.argv.includes("--axe");
const wanted = process.argv.slice(3).filter((a) => a !== "--axe");

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

async function main() {
  if (!fs.existsSync(path.join(root, "index.json"))) throw new Error("storybook-static yoxdur: əvvəlcə npm run build-storybook");
  const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8")) as { entries: Record<string, { type: string }> };
  const targets = wanted.length ? wanted : Object.entries(index.entries).filter(([, e]) => e.type === "story").map(([id]) => id);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let violations = 0;
  for (const target of targets) {
    const [id, theme] = target.split("@") as [string, string | undefined];
    const globals = theme ? `&globals=theme:${theme}` : "";
    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story${globals}`, { waitUntil: "networkidle" });
    await page.waitForSelector("#storybook-root .ds-root", { state: "attached", timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const file = path.join(out, `${id}${theme ? `@${theme}` : ""}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    if (axe) {
      const result = await new AxeBuilder({ page }).include("#storybook-root").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of result.violations) {
        violations++;
        console.log(`  axe ${v.id} (${v.impact}): ${v.nodes.length} element — ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(" ")}`);
      }
    }
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
