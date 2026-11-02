import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

const themeOf = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const cssVar = (page: import("@playwright/test").Page, name: string) =>
  page.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), name);

test("picking an era puts the persons page into that period", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/persons/");
  await expect.poll(() => themeOf(page)).toBe("default");
  await page.getByRole("button", { name: /Səfəvi/ }).first().click();
  await expect.poll(() => themeOf(page)).toBe("sefevi");
  await expect(page.getByTestId("art-credit")).toContainText("Metropolitan Museum");
  await page.getByRole("button", { name: /Əfşar/ }).first().click();
  await expect.poll(() => themeOf(page)).toBe("efshar");
  expect(errors).toEqual([]);
});

test("a simulation follows the period of each step", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/az/persons/shah-ismayil/");
  // Childhood is still in the Ağqoyunlu period, with its art behind the start card.
  await expect(page.getByTestId("theme-art")).toHaveAttribute("data-theme-id", "turkman-tebriz");
  await startJourney(page);
  await expect.poll(() => themeOf(page)).toBe("turkman-tebriz");

  await page.goto("/az/states/afshar/?step=1739-india");
  await page.getByRole("dialog").getByRole("button").first().click();
  await expect.poll(() => themeOf(page)).toBe("efshar-hind");

  await page.goto("/az/conflicts/");
  await expect.poll(() => themeOf(page)).toBe("muasir-zefer");
  expect(await cssVar(page, "--theme-primary")).toBe("#0a5c8a");
});

test("reduced motion turns the ambient effects off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/az/persons/");
  await page.getByRole("button", { name: /Ağqoyunlu/ }).first().click();
  await expect.poll(() => themeOf(page)).toBe("turkman-tebriz");
  await expect(page.getByTestId("ambient-particles")).toHaveCount(0);
});
