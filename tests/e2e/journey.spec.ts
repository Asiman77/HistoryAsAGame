import { expect, test } from "@playwright/test";
import { collectErrors, loadPersons, startJourney } from "./helpers";

const persons = loadPersons();
const stageHeading = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("heading", { level: 2, name, exact: true });

test("landing lists every person in data/ and links to their journey", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/");
  for (const p of persons) await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(persons[0]!.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/az/person/${persons[0]!.id}/`));
  expect(errors).toEqual([]);
});

for (const person of persons) {
  test(`${person.id}: whole life from birth to legacy`, async ({ page, viewport }) => {
    // The step counter lives in the desktop side panel (>= 1024px).
    const desktopLayout = (viewport?.width ?? 0) >= 1024;
    const errors = collectErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/az/person/${person.id}/`);
    await startJourney(page);
    const next = page.getByRole("button", { name: /Növbəti|İrs və nəticə/ }).first();

    for (let i = 0; i < person.titles.length; i++) {
      await expect(stageHeading(page, person.titles[i]!)).toBeVisible();
      if (desktopLayout) await expect(page.getByText(`${i + 1} / ${person.titles.length}`)).toBeVisible();
      await next.click();
    }

    await expect(page.getByText("Həyatın rəqəmlərlə")).toBeVisible();
    if (person.hasQuiz) await expect(page.getByRole("button", { name: "Sınağa başla" })).toBeVisible();

    // Back from legacy lands on the last stage.
    await page.getByRole("button", { name: "Həyat xəttinə qayıt" }).click();
    await expect(stageHeading(page, person.titles.at(-1)!)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("keyboard arrows and timeline navigate between stages", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard navigation is a desktop feature");
  const p = persons[0]!;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/az/person/${p.id}/`);
    await startJourney(page);
  await page.keyboard.press("ArrowRight");
  await expect(stageHeading(page, p.titles[1]!)).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(stageHeading(page, p.titles[0]!)).toBeVisible();
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").nth(4).click();
  await expect(stageHeading(page, p.titles[4]!)).toBeVisible();
});

test("choice moment reveals the historical decision", async ({ page }) => {
  const p = persons.find((x) => x.hasChoice)!;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/az/person/${p.id}/`);
    await startJourney(page);
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").nth(p.firstChoice).click();
  await expect(stageHeading(page, p.titles[p.firstChoice]!)).toBeVisible();
  await page.getByRole("button", { name: "Sən olsaydın nə edərdin?" }).click();
  await page.locator("article li button").first().click();
  await expect(page.getByText("Niyə belə oldu?")).toBeVisible();
  await expect(page.getByText(/Tarixi seçim/).first()).toBeVisible();
});

test("learning mode shows facts and sources", async ({ page }) => {
  await page.goto(`/az/person/${persons[0]!.id}/`);
    await startJourney(page);
  await page.getByRole("radio", { name: "Öyrənmə" }).first().click();
  await expect(page.getByText("Yoxlanılmış faktlar")).toBeVisible();
  await expect(page.getByText("Mənbələr", { exact: true })).toBeVisible();
});

test("legacy quiz can be completed", async ({ page }) => {
  const p = persons.find((x) => x.hasQuiz)!;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/az/person/${p.id}/`);
    await startJourney(page);
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").last().click();
  await page.getByRole("button", { name: "İrs və nəticə →" }).click();
  await page.getByRole("button", { name: "Sınağa başla" }).click();
  for (;;) {
    await page.getByText(/^Sual \d+ \/ \d+$/).waitFor();
    await page.locator("section ul li button").first().click();
    const finish = page.getByRole("button", { name: "Nəticəni gör" });
    if (await finish.isVisible()) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: "Növbəti sual" }).click();
  }
  await expect(page.getByText(/düzgün cavab/)).toBeVisible();
});

test("no horizontal page scroll", async ({ page }) => {
  for (const url of ["/az/", `/az/person/${persons[0]!.id}/`]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
