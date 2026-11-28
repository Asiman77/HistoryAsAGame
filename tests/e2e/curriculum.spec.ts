import { expect, test } from "@playwright/test";

/**
 * "Dərsliklə öyrən" (phase 7) on the curriculum of the approved textbooks (data/curriculum).
 * Topics that tell simulation steps open; the others are listed as "hazırlanır".
 */

test("a topic from the grade list, through its steps and quiz, to the next topic", async ({ page }) => {
  await page.goto("/az/kurikulum/7/");
  await expect(page.getByTestId("sample-notice")).toHaveCount(0);
  await expect(page.getByTestId("grade-screen")).toContainText("Dərslik: Azərbaycan tarixi, 7-ci sinif üçün dərslik");
  // The first section with work left opens: the earlier ones have no topic with steps yet.
  await expect(page.locator('[data-section="vahid-azerbaycan-ugrunda"]')).toHaveAttribute("aria-current", "true");
  const row = page.locator('[data-topic="sefevi-osmanli-muharibelerinin-baslanmasi"]');
  await expect(row).toHaveAttribute("data-status", "new");
  await expect(row.getByTestId("topic-meta")).toContainText("§ 25 · 1 mərhələ");
  await row.getByTestId("topic-action").click();

  await expect(page).toHaveURL(/\/az\/kurikulum\/7\/sefevi-osmanli-muharibelerinin-baslanmasi\//);
  await expect(page.getByTestId("simulation-shell")).toHaveAttribute("data-step", "ismayil-chaldiran");
  await expect(page.getByTestId("step-content")).toContainText("Mərhələ 1 / 1 · Şah İsmayıl");
  await page.getByTestId("step-final").click();

  await expect(page).toHaveURL(/\/sefevi-osmanli-muharibelerinin-baslanmasi\/final\/$/);
  await expect(page.getByTestId("topic-final")).toHaveAttribute("data-completed", "true");
  await expect(page.getByTestId("topic-next")).toContainText("XV–XVI əsrlərdə Azərbaycan mədəniyyəti");

  await page.goto("/az/kurikulum/7/");
  await expect(row).toHaveAttribute("data-status", "done");
  await expect(row.getByTestId("topic-action")).toHaveText("Təkrarla");
});

test("a topic tells person and state steps, each linked to its own simulation", async ({ page }) => {
  await page.goto("/az/kurikulum/10/azerbaycan-torpaqlarinin-azad-olunmasi-ugrunda-mubarize/?step=1735-caucasus");
  await expect(page.getByTestId("step-content")).toContainText("Əfşarlar dövləti");
  await expect(page.getByTestId("owner-link").getByRole("link")).toHaveAttribute("href", "/az/states/afshar/?step=1735-caucasus");
  await page.goto("/az/kurikulum/10/azerbaycan-torpaqlarinin-azad-olunmasi-ugrunda-mubarize/?step=nadir-baghavard");
  await expect(page.getByTestId("step-content")).toContainText("Nadir Şah Əfşar");

  await page.goto("/az/kurikulum/10/");
  await page.locator('[data-section="azerbaycan-xvi-xviii-esrlerde"]').click();
  const topic = page.locator('[data-topic="azerbaycan-torpaqlarinin-azad-olunmasi-ugrunda-mubarize"]');
  await expect(topic).toHaveAttribute("data-status", "progress");
  await expect(topic.getByRole("progressbar")).toBeVisible();
});

test("topics without steps are listed as being prepared, without a link", async ({ page }) => {
  await page.goto("/az/kurikulum/6/");
  await expect(page.getByTestId("grade-screen")).toBeVisible();
  const rows = page.getByTestId("topic-row");
  await expect(rows.first()).toHaveAttribute("data-status", "preparing");
  await expect(rows.first()).toContainText("Əsas tarixi anlayışlar və zaman ölçü vahidləri");
  await expect(page.getByTestId("topic-list").getByRole("link")).toHaveCount(0);
});

test("the timeline keeps the events of a grade's topics and zooms to their years", async ({ page }) => {
  await page.goto("/az/zaman/?year=1501");
  const slider = page.getByTestId("year-slider");
  const min = Number(await slider.getAttribute("aria-valuemin"));
  const all = await page.getByTestId("lane-events").getByRole("button").count();
  const chip = page.locator('[data-testid="grade-filter"][data-grade="7"]');
  // A click before hydration is lost: click until the page answers.
  await expect(async () => {
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
  await expect(page).toHaveURL(/grade=7/);
  await expect.poll(() => page.getByTestId("lane-events").getByRole("button").count()).toBeLessThan(all);
  await expect.poll(async () => Number(await slider.getAttribute("aria-valuemin"))).toBeGreaterThan(min);
  await page.getByTestId("all-eras").click();
  await expect(page).not.toHaveURL(/grade=/);
  // Grade 6 has no topic with steps yet: its chip waits.
  await expect(page.locator('[data-testid="grade-filter"][data-grade="6"]')).toHaveCount(0);
});
