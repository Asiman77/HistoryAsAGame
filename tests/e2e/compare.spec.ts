import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

test("default pair: Uzun Həsən and Şah İsmayıl never meet, but both held Təbriz", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/compare/");
  await expect(page.getByRole("heading", { level: 1, name: "Müqayisə" })).toBeVisible();
  await expect(page.getByTestId("compare-pick-a")).toHaveValue("person:uzun-hasan");
  await expect(page.getByTestId("compare-pick-b")).toHaveValue("person:shah-ismayil");
  await expect(page.getByTestId("compare-overlap")).toContainText("üst-üstə düşmür");
  await expect(page.getByTestId("compare-no-meetings")).toBeVisible();
  const tebriz = page.getByTestId("compare-shared-place").filter({ hasText: "Təbriz" });
  await expect(tebriz).toHaveCount(1);
  await expect(tebriz).toContainText("1501");
  // Both lanes on one axis, with every step as a link.
  await expect(page.getByTestId("compare-lane-a").getByRole("link").first()).toBeVisible();
  await expect(page.getByTestId("compare-lane-b").getByRole("link").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("Nadir Şah and the Afshar state meet: same place and year, or the same battle", async ({ page }) => {
  await page.goto("/az/compare/?a=person:nadir-shah&b=state:afshar");
  await expect(page.getByTestId("compare-overlap")).toContainText("Ortaq illər: 1722–1747");
  const meetings = page.getByTestId("compare-meeting");
  expect(await meetings.count()).toBeGreaterThan(5);
  const kandahar = meetings.filter({ hasText: "1738" });
  await expect(kandahar).toContainText("Eyni yer, eyni il");
  await expect(kandahar).toContainText("Eyni döyüş");
  await expect(page.getByTestId("compare-meeting-line").first()).toBeAttached();
});

test("picking and swapping keep the URL shareable", async ({ page }) => {
  await page.goto("/az/compare/");
  await page.getByTestId("compare-pick-b").selectOption("person:nadir-shah");
  await expect(page).toHaveURL(/a=person%3Auzun-hasan&b=person%3Anadir-shah/);
  await page.getByTestId("compare-swap").click();
  await expect(page).toHaveURL(/a=person%3Anadir-shah&b=person%3Auzun-hasan/);
  await expect(page.getByTestId("compare-list-a")).toContainText("Nadir");
  // Picking the other side's owner swaps instead of comparing a simulation with itself.
  await page.getByTestId("compare-pick-a").selectOption("person:uzun-hasan");
  await expect(page.getByTestId("compare-pick-b")).toHaveValue("person:nadir-shah");
  await page.reload();
  await expect(page.getByTestId("compare-pick-a")).toHaveValue("person:uzun-hasan");
});

test("an unknown owner in the link falls back with a notice", async ({ page }) => {
  await page.goto("/az/compare/?a=person:sultan-selim");
  await expect(page.getByTestId("compare-notice")).toContainText("person:sultan-selim");
  await expect(page.getByTestId("compare-pick-a")).toHaveValue("person:uzun-hasan");
});

test("a step deep-links into its simulation", async ({ page }) => {
  await page.goto("/az/compare/");
  await page.getByTestId("compare-list-b").getByTestId("compare-step").filter({ hasText: "Təbrizdə taxta çıxma" }).click();
  await expect(page).toHaveURL(/\/persons\/shah-ismayil\/\?step=ismayil-coronation/);
});

test("the hub links to the compare page", async ({ page }) => {
  await page.goto("/az/");
  await page.getByTestId("hub-explore").getByRole("link", { name: /Müqayisə et/ }).click();
  await expect(page).toHaveURL(/\/az\/compare\/$/);
  await expect(page.getByTestId("compare-page")).toBeVisible();
});

test("the page itself never scrolls sideways; only the axis does", async ({ page }) => {
  await page.goto("/az/compare/?a=person:nadir-shah&b=conflict:karabakh-war-2020");
  await expect(page.getByTestId("compare-axis")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
