import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

const themeOf = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));

test("picking an era narrows the persons and puts the page into that period", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/sexsiyyetler/");
  const root = page.getByTestId("theme-root");
  await expect(root).toHaveAttribute("data-theme", "default");
  const eras = page.getByRole("radiogroup", { name: "Dövr" });
  await eras.getByRole("radio", { name: /Səfəvi/ }).click();
  await expect(root).toHaveAttribute("data-theme", "sefevi");
  await expect(page).toHaveURL(/\?dovr=sefevi$/);
  await expect(page.getByTestId("person-card")).toHaveCount(2);
  await eras.getByRole("radio", { name: /Əfşar/ }).click();
  await expect(root).toHaveAttribute("data-theme", "efshar");
  await expect(page.getByTestId("person-card")).toHaveCount(1);
  // A shared link opens the same filter.
  await page.goto("/az/sexsiyyetler/?dovr=agqoyunlu");
  await expect(root).toHaveAttribute("data-theme", "turkman-tebriz");
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

  await page.goto("/az/doyusler/");
  await expect(page.getByTestId("theme-root")).toHaveAttribute("data-theme", "muasir-zefer");
  // --bg-base is a registered <color>, so it computes to rgb(); #06111D is the 2020 ground.
  await expect.poll(() => page.getByTestId("theme-root").evaluate((el) => getComputedStyle(el).getPropertyValue("--bg-base").trim())).toBe("rgb(6, 17, 29)");
});

test("reduced motion stills the atmosphere: no particles, no parallax", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/az/");
  const atmosphere = page.getByTestId("atmosphere-background").first();
  await expect(atmosphere).toHaveAttribute("data-still", "true");
  await expect(page.getByTestId("effect-dust")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(atmosphere).toHaveAttribute("data-still", "false");
  await expect(page.getByTestId("effect-dust")).toHaveCount(1);
});
