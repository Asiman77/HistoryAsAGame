import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

const ISMAYIL = "/az/person/shah-ismayil/";
const timeline = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button");
const stage = (page: import("@playwright/test").Page, name: string) => page.getByRole("heading", { level: 2, name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("start gate unlocks the story; the mute choice is remembered", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(ISMAYIL);
  await expect(page.getByRole("dialog", { name: "Şah İsmayıl Xətai" })).toBeVisible();
  await page.getByRole("button", { name: /Səsi söndür/ }).click();
  await startJourney(page);
  await expect(page.getByRole("button", { name: "Səsi aç" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Səs söndürülüb")).toBeVisible();
  expect(errors).toEqual([]);
});

test("progress is saved and can be resumed", async ({ page }) => {
  await page.goto(ISMAYIL);
  await startJourney(page);
  await timeline(page).nth(5).click();
  await expect(stage(page, "Lahicanda təhsil")).toBeVisible();
  await page.reload();
  await startJourney(page, /Qaldığın yerdən davam et/);
  await expect(stage(page, "Lahicanda təhsil")).toBeVisible();
});

test("political map legend follows the year and marks borders as approximate", async ({ page, viewport }) => {
  await page.goto(ISMAYIL);
  await startJourney(page);
  const legend = page.getByTestId("map-legend");
  // Below 1024px the legend starts collapsed.
  if ((viewport?.width ?? 0) < 1024) await legend.getByRole("button", { name: "Xəritə açarını göstər" }).click();
  await expect(legend.getByText("Sərhədlər təxminidir")).toBeVisible();
  await timeline(page).nth(10).click();
  await expect(legend.getByText("Səfəvi dövlətinin yaranması")).toBeVisible();
  await expect(legend.getByText("Səfəvi dövləti", { exact: true })).toBeVisible();
});

test("battle card names sides, commanders and forces with a source", async ({ page }) => {
  await page.goto(ISMAYIL);
  await startJourney(page);
  await timeline(page).nth(14).click();
  await expect(stage(page, "Çaldıran döyüşü")).toBeVisible();
  const card = page.getByRole("region", { name: /Döyüş/ });
  await expect(card.getByText("Osmanlı ordusu")).toBeVisible();
  await expect(card.getByText("Məhəmməd xan Ustaclu (həlak oldu)")).toBeVisible();
  await expect(card.getByText(/60 000–100 000/)).toBeVisible();
  await expect(card.getByRole("link", { name: "Battle of Chaldiran" })).toBeVisible();
  await expect(card.getByText("Tarixi əhəmiyyəti")).toBeVisible();
});

test("glossary terms explain themselves", async ({ page }) => {
  await page.goto(ISMAYIL);
  await startJourney(page);
  await timeline(page).nth(7).click();
  await page.getByRole("radio", { name: "Öyrənmə" }).first().click();
  await page.locator(".glossary-term", { hasText: /^qızılbaş$/i }).first().click();
  await expect(page.getByRole("tooltip")).toContainText("qırmızı baş");
});

test("meanwhile in the world and the link to another person's story", async ({ page }) => {
  await page.goto(ISMAYIL);
  await startJourney(page);
  await expect(page.getByText(/Bu zaman dünyada · 1487/)).toBeVisible();
  await page.getByRole("link", { name: /Uzun Həsən: Trabzon şahzadəsi ilə nikah/ }).click();
  await expect(page).toHaveURL(/\/az\/person\/uzun-hasan\/\?step=uzun-hasan-despina/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(stage(page, "Trabzon şahzadəsi ilə nikah")).toBeVisible();
});

test("city card opens from the map and jumps to a stage", async ({ page, isMobile }) => {
  test.skip(isMobile, "map markers are tested on larger screens");
  await page.goto(ISMAYIL);
  await startJourney(page);
  await timeline(page).nth(10).click();
  const tabriz = page.locator(".place-marker .label", { hasText: /^Təbriz$/ });
  await expect(tabriz).toBeVisible({ timeout: 20_000 });
  await tabriz.click();
  const card = page.getByRole("dialog", { name: "Təbriz" });
  await expect(card.getByText("Bu həyatda burada")).toBeVisible();
  await card.getByRole("button", { name: /Mərhələyə keç: Xətai/ }).click();
  await expect(stage(page, "Xətai: şair şah")).toBeVisible();
});

test("teacher mode enlarges the UI and follows presentation clickers", async ({ page, isMobile }) => {
  test.skip(isMobile, "projector setup");
  await page.goto(ISMAYIL);
  await startJourney(page);
  await page.getByRole("button", { name: "Səs və ayarlar" }).click();
  await page.getByRole("switch", { name: "Müəllim rejimi" }).click();
  await expect(page.locator("html")).toHaveClass(/teacher-mode/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("PageDown");
  await expect(stage(page, "Atanın ölüm xəbəri")).toBeVisible();
  await page.keyboard.press("PageUp");
  await expect(stage(page, "Ərdəbildə doğuluş")).toBeVisible();
});

test("audio files are served in both formats", async ({ request }) => {
  for (const f of ["music-base", "music-battle", "amb-wind", "sfx-sprite"])
    for (const ext of ["webm", "mp3"]) expect((await request.get(`/audio/${f}.${ext}`)).ok(), `${f}.${ext}`).toBe(true);
  expect((await request.get("/data/territories/y1501.json")).ok()).toBe(true);
});
