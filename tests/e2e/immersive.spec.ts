import { expect, test, type Page } from "@playwright/test";
import { collectErrors } from "./helpers";

/** What the legacy story panel offered, in the SimulationShell (Q6: "Ətraflı", city card, battle card). */
const ISMAYIL = "/az/sexsiyyetler/shah-ismayil/";
const heading = (page: Page) => page.getByTestId("step-content").getByRole("heading", { level: 2 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the sound choice is remembered", async ({ page, viewport }) => {
  const errors = collectErrors(page);
  await page.goto(ISMAYIL);
  const sound = page.getByRole("button", { name: "Səsi söndür" });
  await sound.click();
  await expect(page.getByRole("button", { name: "Səsi aç" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Səsi aç" })).toBeVisible();
  expect(errors).toEqual([]);
  void viewport;
});


test("battle card names sides, commanders and forces with a source", async ({ page }) => {
  await page.goto(`${ISMAYIL}?step=ismayil-chaldiran`);
  await expect(heading(page)).toHaveText("Çaldıran döyüşü");
  const card = page.getByTestId("battle-card");
  await expect(card.getByText("Osmanlı ordusu")).toBeVisible();
  await expect(card.getByText("Məhəmməd xan Ustaclu (həlak oldu)")).toBeVisible();
  await expect(card.getByText(/60 000–100 000/)).toBeVisible();
  await expect(card.getByRole("link", { name: "Battle of Chaldiran" })).toBeVisible();
  await expect(card.getByText("Tarixi əhəmiyyəti")).toBeVisible();
  await expect(card.getByTestId("battle-result")).toHaveText("Məğlubiyyət");
});

test("glossary terms of the step are explained in Ətraflı", async ({ page }) => {
  await page.goto(`${ISMAYIL}?step=ismayil-erzincan&mode=learn`);
  const terms = page.getByTestId("more-terms");
  await expect(terms.getByText(/^qızılbaş/i).first()).toBeVisible();
  await expect(terms).toContainText("qırmızı baş");
});

test("meanwhile in the world, and the link to another person's story and back", async ({ page }) => {
  await page.goto(`${ISMAYIL}?step=ismayil-birth`);
  await page.getByTestId("more").locator("summary").click();
  await expect(page.getByTestId("more-world")).toContainText("Bu zaman dünyada · 1487");
  await page.getByTestId("step-content").getByRole("link", { name: /Uzun Həsən · Trabzon şahzadəsi ilə nikah/ }).click();
  await expect(page).toHaveURL(/\/az\/sexsiyyetler\/uzun-hasan\/\?step=uzun-hasan-despina/);
  await expect(heading(page)).toHaveText("Trabzon şahzadəsi ilə nikah");
  const back = page.getByTestId("return-link");
  await expect(back).toContainText("Şah İsmayıl Xətai · Ərdəbildə doğuluş");
  await back.click();
  await expect(page).toHaveURL(/\/az\/sexsiyyetler\/shah-ismayil\/\?step=ismayil-birth/);
  await expect(heading(page)).toHaveText("Ərdəbildə doğuluş");
});

test("city card opens from the place name and jumps to a stage", async ({ page }) => {
  await page.goto(`${ISMAYIL}?step=ismayil-coronation`);
  await page.getByTestId("place-link").click();
  const card = page.getByRole("dialog", { name: "Təbriz" });
  await expect(card.getByText("Bu hekayədə burada")).toBeVisible();
  await card.getByRole("button", { name: /Mərhələyə keç: Xətai/ }).click();
  await expect(heading(page)).toHaveText("Xətai: şair şah");
  await expect(card).toHaveCount(0);
});

test("city card opens from a marker on the map", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "markers are tested where the map is not under the sheet");
  await page.goto(`${ISMAYIL}?step=ismayil-coronation`);
  await expect(page.getByTestId("gl-map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await page.locator(".gl-current[data-clickable=true]").click();
  await expect(page.getByTestId("place-card")).toHaveAttribute("data-place", "tebriz");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("place-card")).toHaveCount(0);
});

test.fixme("teacher mode in the shell (phase 13: projector mode)", async () => {});

test("audio files are served in both formats", async ({ request }) => {
  for (const f of ["music-base", "music-battle", "amb-wind", "sfx-sprite"])
    for (const ext of ["webm", "mp3"]) expect((await request.get(`/audio/${f}.${ext}`)).ok(), `${f}.${ext}`).toBe(true);
  expect((await request.get("/data/territories/y1501.json")).ok()).toBe(true);
});
