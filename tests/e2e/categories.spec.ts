import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("home shows the three sections and each opens its own page", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/");
  for (const [name, url] of [
    ["Tarixi şəxsiyyətlər", "/az/persons/"],
    ["Döyüşlər və müharibələr", "/az/conflicts/"],
    ["Dövlətlər", "/az/states/"],
  ] as const) {
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.getByRole("link", { name: /Ana səhifə/ }).click();
    await expect(page).toHaveURL(/\/az\/$/);
  }
  expect(errors).toEqual([]);
});

test("planned simulations are listed as coming soon", async ({ page }) => {
  await page.goto("/az/conflicts/");
  await expect(page.getByRole("heading", { name: "44 günlük Vətən müharibəsi" })).toBeVisible();
  await page.goto("/az/states/");
  await expect(page.getByRole("heading", { name: "Əfşarlar dövləti" })).toBeVisible();
  await expect(page.getByText("Tezliklə").first()).toBeVisible();
});

test("old person URLs redirect and keep the deep link", async ({ page }) => {
  await page.goto("/az/person/shah-ismayil/?step=ismayil-chaldiran");
  await expect(page).toHaveURL(/\/az\/persons\/shah-ismayil\/\?step=ismayil-chaldiran/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Çaldıran döyüşü" })).toBeVisible();
});

test("refs to missing entities are passive; person links return to where you were", async ({ page }) => {
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-chaldiran");
  await startJourney(page, /mərhələsindən başla/);
  // Çaldıran döyüşü and Osmanlı dövləti have no simulation yet.
  const passive = page.locator('[data-passive="true"]', { hasText: "Çaldıran döyüşü (1514)" });
  await expect(passive).toContainText("tezliklə");
  await expect(page.getByRole("link", { name: /Çaldıran döyüşü \(1514\)/ })).toHaveCount(0);

  // Cross into Uzun Həsən's story and come back.
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").first().click();
  await page.locator("article").getByRole("link", { name: /Uzun Həsən: Trabzon şahzadəsi ilə nikah/ }).click();
  await expect(page).toHaveURL(/\/az\/persons\/uzun-hasan\/\?step=uzun-hasan-despina/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Trabzon şahzadəsi ilə nikah" })).toBeVisible();
  const back = page.getByTestId("return-link");
  await expect(back).toContainText("Şah İsmayıl Xətai · Ərdəbildə doğuluş");
  await back.click();
  await expect(page).toHaveURL(/\/az\/persons\/shah-ismayil\/\?step=ismayil-birth/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Ərdəbildə doğuluş" })).toBeVisible();
});
