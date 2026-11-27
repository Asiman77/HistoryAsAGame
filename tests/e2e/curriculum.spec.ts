import { expect, test } from "@playwright/test";

/**
 * "Dərsliklə öyrən" (phase 7). data/ has no curriculum yet: the normal build shows the empty
 * states. The whole flow runs on a build with the sample grade of fixtures/ (marked "nümunə"):
 *   CURRICULUM_SAMPLE=1 npm run build && CURRICULUM_SAMPLE=1 npx playwright test curriculum
 */
const sample = process.env.CURRICULUM_SAMPLE === "1";

test.describe("without curriculum data", () => {
  test.skip(sample, "the sample build has curriculum data");

  test("grades show the empty state and the timeline's grade chips wait for the curriculum", async ({ page }) => {
    await page.goto("/az/kurikulum/8/");
    await expect(page.getByText("Kurikulum hazırlanır")).toBeVisible();
    await expect(page.getByTestId("grade-screen")).toHaveCount(0);
    await page.goto("/az/zaman/?year=1501");
    await expect(page.getByTestId("grade-filter")).toHaveCount(0);
    await expect(page.getByTestId("time-axis")).toContainText("Sinif bölgüsü kurikulumla gələcək");
  });
});

test.describe("with the sample grade", () => {
  test.skip(!sample, "build with CURRICULUM_SAMPLE=1");

  test("a topic from the grade list, through its steps and quiz, to the next topic", async ({ page }, info) => {
    await page.goto("/az/kurikulum/8/");
    await expect(page.getByTestId("sample-notice")).toBeVisible();
    const row = page.locator('[data-topic="sample-sefevi"]');
    await expect(row).toHaveAttribute("data-status", "new");
    await row.getByTestId("topic-action").click();

    await expect(page).toHaveURL(/\/az\/kurikulum\/8\/sample-sefevi\//);
    const shell = page.getByTestId("simulation-shell");
    await expect(shell).toHaveAttribute("data-step", "ismayil-erzincan");
    await expect(page.getByTestId("step-content")).toContainText("Mərhələ 1 / 4 · Şah İsmayıl");
    // The step strip is a desktop part; phones and tablets get the bottom sheet.
    if (info.project.name === "desktop") await expect(page.getByTestId("shell-timeline")).toContainText("Mövzunun mərhələləri");
    for (const id of ["ismayil-sharur", "ismayil-coronation", "ismayil-chaldiran"]) {
      await page.getByTestId("step-next").click();
      await expect(shell).toHaveAttribute("data-step", id);
    }
    await page.getByTestId("step-final").click();

    await expect(page).toHaveURL(/\/sample-sefevi\/final\/$/);
    await expect(page.getByTestId("topic-final")).toHaveAttribute("data-completed", "true");
    await expect(page.getByTestId("final-quiz")).toBeVisible();
    await expect(page.getByTestId("topic-next")).toContainText("Əfşarlar dövləti");

    await page.goto("/az/kurikulum/8/");
    await expect(row).toHaveAttribute("data-status", "done");
    await expect(row.getByTestId("topic-action")).toHaveText("Təkrarla");
  });

  test("a topic tells person and state steps, each linked to its own simulation", async ({ page }) => {
    await page.goto("/az/kurikulum/8/sample-efshar/?step=1739-india");
    await expect(page.getByTestId("step-content")).toContainText("Əfşarlar dövləti");
    await expect(page.getByTestId("owner-link").getByRole("link")).toHaveAttribute("href", "/az/states/afshar/?step=1739-india");
    await page.goto("/az/kurikulum/8/");
    await page.locator('[data-section="sample-section-2"]').click();
    const efshar = page.locator('[data-topic="sample-efshar"]');
    await expect(efshar).toHaveAttribute("data-status", "progress");
    await expect(efshar.getByRole("progressbar")).toBeVisible();
    const preparing = page.locator('[data-topic="sample-preparing"]');
    await expect(preparing).toHaveAttribute("data-status", "preparing");
    await expect(preparing.getByRole("link")).toHaveCount(0);
  });

  test("the timeline keeps the events of a grade's topics and zooms to their years", async ({ page }) => {
    await page.goto("/az/zaman/?year=1501");
    const slider = page.getByTestId("year-slider");
    const min = Number(await slider.getAttribute("aria-valuemin"));
    const all = await page.getByTestId("lane-events").getByRole("button").count();
    await page.locator('[data-testid="grade-filter"][data-grade="8"]').click();
    await expect(page.locator('[data-testid="grade-filter"][data-grade="8"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/grade=8/);
    await expect.poll(() => page.getByTestId("lane-events").getByRole("button").count()).toBeLessThan(all);
    await expect.poll(async () => Number(await slider.getAttribute("aria-valuemin"))).toBeGreaterThan(min);
    await page.getByTestId("all-eras").click();
    await expect(page).not.toHaveURL(/grade=/);
  });
});
