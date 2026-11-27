import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { collectErrors } from "./helpers";

/** Zaman şkalası (/az/zaman/, phase 6). Eras come from data/eras, nothing is hard-coded beyond what the data says. */
const eras = fs
  .readdirSync("data/eras")
  .map((f) => JSON.parse(fs.readFileSync(`data/eras/${f}`, "utf8")) as { id: string; startYear: number; endYear: number; themeId: string })
  .sort((a, b) => a.startYear - b.startYear);
const theme = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const year = (page: Page) => page.getByTestId("timeline-year");

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a shared ?year= opens that year with its era, period theme and the persons alive", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/zaman/?year=1514");
  await expect(year(page)).toHaveText("1514");
  await expect(page.getByTestId("timeline-era")).toHaveText("Səfəvi dövləti");
  await expect.poll(() => theme(page)).toBe("sefevi");
  await expect(page.getByTestId("timeline-persons")).toContainText("Şah İsmayıl · 27 yaş");
  expect(errors).toEqual([]);
});

test("the slider moves by year, decade and era from the keyboard and keeps the year in the address", async ({ page }) => {
  await page.goto("/az/zaman/?year=1514");
  const slider = page.getByTestId("year-slider");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(year(page)).toHaveText("1515");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(year(page)).toHaveText("1525");
  await expect(slider).toHaveAttribute("aria-valuenow", "1525");
  await expect(slider).toHaveAttribute("aria-valuetext", "1525, Səfəvi dövləti");
  const next = eras.find((e) => e.startYear > 1525)!;
  await page.keyboard.press("PageUp");
  await expect(year(page)).toHaveText(String(next.startYear));
  await expect(page).toHaveURL(new RegExp(`year=${next.startYear}`));
  await expect.poll(() => theme(page)).toBe(next.themeId);
});

test("years without a map say so; an era band zooms the axis into the era", async ({ page }) => {
  await page.goto("/az/zaman/?year=1900");
  await expect(page.getByTestId("map-gap")).toContainText("siyasi xəritə hazırlanır");
  await expect(page.getByTestId("timeline-era")).toHaveText("Dövr məlumatı hazırlanır");
  const sefevi = eras.find((e) => e.id === "sefevi")!;
  await page.locator('[data-era="sefevi"]').click();
  await expect(page.locator('[data-era="sefevi"]')).toHaveAttribute("aria-pressed", "true");
  await expect(year(page)).toHaveText(String(sefevi.startYear));
  await expect(page.getByTestId("year-slider")).toHaveAttribute("aria-valuemin", String(sefevi.startYear));
  await expect(page.getByTestId("map-gap")).toHaveCount(0);
  await page.getByTestId("all-eras").click();
  await expect(page.getByTestId("year-slider")).toHaveAttribute("aria-valuemin", String(eras[0]!.startYear));
});

test("a state on the map opens the ruler panel of the year, with the way into the ruler's life", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the map is checked where WebGL runs on the GPU");
  await page.goto("/az/zaman/?year=1514");
  await expect(page.getByTestId("gl-map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  const label = page.locator('.gl-polity[data-polity="safavid"]');
  await expect(label).toHaveCount(1, { timeout: 15_000 });
  await label.dispatchEvent("click");
  const panel = page.getByTestId("polity-panel");
  await expect(panel.getByTestId("ruler-name")).toContainText("İsmayıl");
  await expect(panel).toContainText("Təbriz");
  await expect(panel.getByTestId("ruler-live")).toHaveAttribute("href", /\/az\/sexsiyyetler\/shah-ismayil\/$/);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  // The year's events stand on the map.
  await expect(page.locator('.gl-event[aria-label*="Çaldıran"]')).toHaveCount(1);
});

test("the home page slider opens the timeline on its year; the old address redirects", async ({ page }) => {
  await page.goto("/az/");
  const box = page.getByTestId("timeline-preview");
  const full = box.getByTestId("preview-open");
  // Input that lands before hydration is lost, and the same value again is no change for React:
  // move away and back until the page answers.
  const slider = box.getByRole("slider", { name: "İl seçimi" });
  await expect(async () => {
    await slider.fill("1600");
    await slider.fill("1736");
    await expect(full).toHaveAttribute("href", /\/az\/zaman\/\?year=1736/, { timeout: 1000 });
  }).toPass();
  await full.click();
  await expect(page).toHaveURL(/\/az\/zaman\/\?year=1736/);
  await expect(year(page)).toHaveText("1736");

  await page.goto("/az/timeline/?year=1514");
  await expect(page).toHaveURL(/\/az\/zaman\/\?year=1514/);
  await expect(year(page)).toHaveText("1514");
});
