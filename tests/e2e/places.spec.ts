import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

test("Şuşa: names, who held it, steps from every category and the coming chapters", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/places/shusha/");
  await expect(page.getByRole("heading", { level: 1, name: "Şuşa" })).toBeVisible();
  const membership = page.getByTestId("membership");
  await expect(membership.locator("[data-polity=karabakh-kh]").first()).toBeVisible();
  await expect(membership).toContainText("Bu dövr üçün məzmun hazırlanır");
  const items = page.getByTestId("place-event");
  await expect(items.filter({ hasText: "Şuşa azad olundu" })).toHaveCount(1);
  await expect(items.filter({ hasText: "Dövlət" })).toHaveCount(1);
  await expect(page.getByTestId("place-upcoming").first()).toContainText("Tezliklə");
  expect(errors).toEqual([]);
});

test("scrolling the timeline moves the page from century to century", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/az/places/shusha/");
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await expect.poll(theme).toBe("efshar");
  // Scroll to the end: the last (2020) item wins even if it never reaches the middle.
  await page.mouse.wheel(0, 20000);
  await expect.poll(theme).toBe("muasir-zefer");
});

test("a timeline item deep-links into the simulation step", async ({ page }) => {
  await page.goto("/az/places/tebriz/");
  await page.getByTestId("place-event").filter({ hasText: "Təbrizdə taxta çıxma" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/sexsiyyetler\/shah-ismayil\/\?step=ismayil-coronation/);
});

test("the city card in the simulation opens the place page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/az/sexsiyyetler/shah-ismayil/?step=ismayil-coronation");
  await page.getByTestId("place-link").click();
  await page.getByTestId("place-history-link").click();
  await expect(page).toHaveURL(/\/az\/places\/tebriz\/$/);
  await expect(page.getByTestId("place-page")).toBeVisible();
});
