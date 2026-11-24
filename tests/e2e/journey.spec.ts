import { expect, test, type Page } from "@playwright/test";
import { collectErrors, loadPersons } from "./helpers";

/** Whole journeys in the SimulationShell (phase 5). Persons and steps come from data/, nothing is hard-coded. */
const persons = loadPersons();
const heading = (page: Page) => page.getByTestId("step-content").getByRole("heading", { level: 2 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the persons page lists every person in data/ and opens their simulation", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/sexsiyyetler/");
  for (const p of persons) await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  await page.getByTestId("person-card").filter({ hasText: persons[0]!.name }).click();
  await expect(page).toHaveURL(new RegExp(`/az/sexsiyyetler/${persons[0]!.id}/`));
  await expect(heading(page)).toHaveText(persons[0]!.titles[0]!);
  expect(errors).toEqual([]);
});

for (const person of persons) {
  test(`${person.id}: the whole life, first step to the final screen`, async ({ page }) => {
    test.slow();
    const errors = collectErrors(page);
    await page.goto(`/az/sexsiyyetler/${person.id}/`);
    for (let i = 0; i < person.titles.length; i++) {
      await expect(heading(page)).toHaveText(person.titles[i]!);
      await expect(page.getByTestId("simulation-shell")).toHaveAttribute("data-step", person.stepIds[i]!);
      if (i < person.titles.length - 1) await page.getByTestId("step-next").click();
    }
    await page.getByTestId("step-final").click();
    await expect(page).toHaveURL(new RegExp(`/az/sexsiyyetler/${person.id}/final/$`));
    const final = page.getByTestId("final-screen");
    await expect(final).toHaveAttribute("data-completed", "true");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("irsi");
    await expect(page.getByTestId("final-stats")).toContainText(String(person.titles.length));
    if (person.hasQuiz) await expect(page.getByTestId("final-quiz")).toBeVisible();
    // Every town of the story got its stamp on the way.
    await expect(page.getByTestId("final-passport").getByTestId("stamp").first()).toBeVisible();
    // The way back lands on the simulation.
    await page.getByTestId("final-back").click();
    await expect(page).toHaveURL(new RegExp(`/az/sexsiyyetler/${person.id}/`));
    await expect(heading(page)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("a choice moment reveals the historical decision and why", async ({ page }) => {
  const p = persons.find((x) => x.hasChoice)!;
  await page.goto(`/az/sexsiyyetler/${p.id}/?step=${p.stepIds[p.firstChoice]}`);
  const card = page.getByTestId("choice-card");
  await card.getByRole("button").first().click();
  await expect(card.getByTestId("choice-result")).toBeVisible();
  await expect(card).toContainText("Tarixi seçim");
  await expect(card.getByTestId("choice-result")).toContainText("Tarix dəyişmir");
});

test("coming back to a simulation continues where it was left", async ({ page }) => {
  const p = persons[0]!;
  await page.goto(`/az/sexsiyyetler/${p.id}/?step=${p.stepIds[5]}`);
  await expect(heading(page)).toHaveText(p.titles[5]!);
  await page.goto(`/az/sexsiyyetler/${p.id}/`);
  await expect(heading(page)).toHaveText(p.titles[5]!);
  await page.goto("/az/sexsiyyetler/");
  await expect(page.getByTestId("person-card").filter({ hasText: p.name })).toContainText(`Davam et · 6/${p.titles.length}`);
});

test("no horizontal page scroll", async ({ page }) => {
  const id = persons[0]!.id;
  for (const url of ["/az/", "/az/sexsiyyetler/", "/az/doyusler/", "/az/dovletler/", "/az/mekanlar/", "/az/kurikulum/8/", "/az/pasport/", `/az/sexsiyyetler/${id}/`, `/az/sexsiyyetler/${id}/final/`]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
