import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a shared ?year= opens the slider on that year with its rulers, persons and events", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/timeline/?year=1514");
  await expect(page.getByTestId("year-value")).toHaveText("1514");
  await expect(page.getByTestId("year-rulers")).toContainText("I Səlim");
  await expect(page.getByTestId("year-persons")).toContainText("27 yaşında");
  await expect(page.getByTestId("year-events")).toContainText("Çaldıran döyüşü");
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("sefevi");
  expect(errors).toEqual([]);
});

test("moving the slider changes the year everywhere and keeps it in the address", async ({ page }) => {
  await page.goto("/az/timeline/?year=1514");
  await page.locator("#year-input").fill("1739");
  await expect(page.getByTestId("year-events")).toContainText("Karnal");
  await expect(page.getByTestId("year-persons")).toContainText("Nadir");
  await expect(page).toHaveURL(/year=1739/);
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("efshar");
});

test("years without maps say so instead of an empty map; era bands jump to the era", async ({ page }) => {
  await page.goto("/az/timeline/?year=1900");
  await expect(page.getByTestId("coverage-gap")).toContainText("Bu dövr üçün məzmun hazırlanır");
  await page.getByTestId("era-band").filter({ hasText: "Səfəvi" }).click();
  await expect(page.getByTestId("year-value")).toHaveText("1501");
  await expect(page.getByTestId("coverage-gap")).toHaveCount(0);
});

test("a ruler opens the ruler panel for the chosen year", async ({ page }) => {
  await page.goto("/az/timeline/?year=1514");
  await page.getByTestId("year-rulers").getByRole("button", { name: /I İsmayıl/ }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Səfəvi dövləti" }).first()).toBeVisible();
});

test("the home page carries a compact slider linking to the full timeline", async ({ page }) => {
  await page.goto("/az/");
  const box = page.locator("[data-testid=time-explorer][data-compact=true]");
  await expect(box).toBeVisible();
  await box.locator("#year-input").fill("1736");
  // The link follows the slider once it has rested (debounced); clicking earlier would race it.
  const full = box.getByRole("link", { name: /Tam zaman xətti/ });
  await expect(full).toHaveAttribute("href", /year=1736/);
  await full.click();
  await expect(page).toHaveURL(/\/az\/timeline\/\?year=1736/);
  await expect(page.getByTestId("year-value")).toHaveText("1736");
});
