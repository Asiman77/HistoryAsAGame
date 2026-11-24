import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

test("today's events from every category, with deep links", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/?today=08-23");
  const block = page.getByTestId("on-this-day");
  await expect(block).toHaveAttribute("data-mode", "day");
  await expect(block).toContainText("Tarixdə bu gün");
  await expect(block).toContainText("23 avqust");
  await block.getByTestId("otd-event").filter({ hasText: "Çaldıran döyüşü" }).click();
  await expect(page).toHaveURL(/\/sexsiyyetler\/shah-ismayil\/\?step=ismayil-chaldiran/);
  expect(errors).toEqual([]);
});

test("no event on the day: 'Bu ay tarixdə'", async ({ page }) => {
  // Every month has dated steps today, so the hidden block (no event in the month)
  // is covered by tests/component/home.test.tsx.
  await page.goto("/az/?today=03-02");
  const block = page.getByTestId("on-this-day");
  await expect(block).toHaveAttribute("data-mode", "month");
  await expect(block).toContainText("Bu ay tarixdə");
  await expect(block.getByTestId("otd-event").first()).toBeVisible();
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
