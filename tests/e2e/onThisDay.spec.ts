import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

test("today's events from every category, with deep links", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/?today=08-23");
  const block = page.getByTestId("on-this-day");
  await expect(block).toHaveAttribute("data-mode", "day");
  await expect(block).toContainText("Tarixdə bu gün");
  await block.getByTestId("otd-event").filter({ hasText: "Çaldıran döyüşü" }).click();
  await expect(page).toHaveURL(/\/persons\/shah-ismayil\/\?step=ismayil-chaldiran/);
  expect(errors).toEqual([]);
});

test("no event on the day: 'Bu ay tarixdə'", async ({ page }) => {
  await page.goto("/az/?today=03-02");
  const block = page.getByTestId("on-this-day");
  await expect(block).toHaveAttribute("data-mode", /month|none/);
  await expect(block).toContainText(/Bu ay tarixdə|Bu ay üçün hadisə tapılmadı/);
});

test("27 Sentyabr and 8 Noyabr are shown with their own design", async ({ page }) => {
  await page.goto("/az/?today=09-27");
  await expect(page.getByTestId("on-this-day")).toHaveAttribute("data-special", "anim-gunu");
  await expect(page.getByTestId("special-day")).toContainText("Anım Günü");
  await page.goto("/az/?today=11-08");
  await expect(page.getByTestId("on-this-day")).toHaveAttribute("data-special", "zefer-gunu");
  await expect(page.getByTestId("special-day")).toContainText("Zəfər Günü");
  await expect(page.getByTestId("otd-event").filter({ hasText: "Şuşa azad olundu" })).toBeVisible();
});
