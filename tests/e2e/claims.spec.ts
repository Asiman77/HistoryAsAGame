import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a legend step is marked, explains itself and shows where it was first recorded", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/persons/nadir-shah/?step=nadir-captivity");
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByTestId("step-claim-notice")).toContainText("rəvayətə əsaslanır");
  await page.getByRole("radio", { name: "Öyrənmə" }).first().click();
  const list = page.getByTestId("claim-list");
  await expect(list).toContainText("İlk qeyd");
  await expect(list).toContainText("Versiyalar");
  // The badge explains the kind on hover, focus or tap.
  await list.getByTestId("claim-badge").first().click();
  await expect(page.getByRole("tooltip").filter({ hasText: "Bu niyə rəvayət sayılır?" }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("legends can be hidden in the settings and opened on demand", async ({ page }) => {
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-flight-gilan");
  await page.evaluate(() => {
    const raw = localStorage.getItem("tarix:settings");
    localStorage.setItem("tarix:settings", JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), showLegends: false }));
  });
  await page.reload();
  await startJourney(page, /mərhələsindən başla/);
  await page.getByRole("radio", { name: "Öyrənmə" }).first().click();
  const list = page.getByTestId("claim-list");
  await expect(list.locator("[data-claim-id=ismayil-basket-oath]")).toHaveCount(0);
  await expect(list.locator("[data-claim-id=ismayil-gilan-refuge]")).toBeVisible();
  await page.getByTestId("show-hidden-legends").click();
  await expect(list.locator("[data-claim-id=ismayil-basket-oath]")).toBeVisible();
});

test("the final screen asks 'Fakt yoxsa rəvayət?' and explains each answer", async ({ page }) => {
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-death");
  await startJourney(page, /mərhələsindən başla/);
  await page.getByRole("button", { name: /İrs və nəticə/ }).first().click();
  const quiz = page.getByTestId("fact-or-legend");
  await expect(quiz).toBeVisible();
  await quiz.getByRole("button", { name: "Rəvayət" }).click();
  await expect(quiz.getByTestId("fol-feedback")).toBeVisible();
  await expect(quiz.getByTestId("fol-feedback")).toContainText(/Düzdür|Əslində/);
});
