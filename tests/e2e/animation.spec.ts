import { expect, test } from "@playwright/test";
import { loadPersons, startJourney } from "./helpers";

/**
 * Measures frame pacing while a route is drawn. Headless Chromium renders
 * WebGL in software, so the threshold is loose; the logged numbers are for
 * comparing runs and catching regressions such as per-frame React re-renders.
 */
test("route animation frame pacing", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "measured once");
  const p = loadPersons()[0]!;
  await page.goto(`/az/persons/${p.id}/`);
  await startJourney(page);
  await page.waitForTimeout(4500);
  // Stand on the stage just before the first movement, then step forward onto it.
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").nth(p.firstMove - 1).click();
  await page.waitForTimeout(3500);
  const stats = await page.evaluate(async () => {
    const frames: number[] = [];
    let last = performance.now();
    const until = last + 4000;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        frames.push(now - last);
        last = now;
        if (now < until) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    frames.sort((a, b) => a - b);
    const avg = frames.reduce((s, f) => s + f, 0) / frames.length;
    return { fps: 1000 / avg, p95: frames[Math.floor(frames.length * 0.95)]!, count: frames.length };
  });
  console.log(`route animation: ${stats.fps.toFixed(1)} fps avg, p95 frame ${stats.p95.toFixed(1)} ms, ${stats.count} frames`);
  expect(stats.fps).toBeGreaterThan(20);
});
