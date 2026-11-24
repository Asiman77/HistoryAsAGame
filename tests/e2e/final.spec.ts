import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { collectErrors, loadPersons } from "./helpers";

/** Final screen, quiz, portraits and the passport (phase 5). */
const ismayil = loadPersons().find((p) => p.id === "shah-ismayil")!;
const last = ismayil.stepIds.at(-1)!;
const quiz = (page: Page) => page.getByTestId("final-quiz");

/** Answers whatever is asked with the first possible answer. */
async function answer(page: Page) {
  const q = quiz(page);
  const kind = await q.getAttribute("data-kind");
  if (kind === "order") await page.getByTestId("order-check").click();
  else if (kind === "map") await page.getByTestId("map-quiz").getByRole("button").first().click();
  else await q.getByRole("group").getByRole("button").first().click();
  return kind;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the quiz asks four kinds of question, explains each answer and links to its step", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/final/`);
  const kinds = new Set<string>();
  for (let i = 0; i < 10; i++) {
    if (!(await quiz(page).count())) break;
    await expect(quiz(page).getByText(new RegExp(`Quiz · ${i + 1} / \\d`, "i"))).toBeVisible();
    kinds.add((await answer(page))!);
    const feedback = page.getByTestId("quiz-feedback");
    await expect(feedback).toHaveAttribute("data-right", /true|false/);
    await expect(feedback).toContainText(/Düzdür|Düz deyil/);
    await page.getByTestId("quiz-next").click();
  }
  expect(kinds).toEqual(new Set(["choice", "claim", "order", "map"]));
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.getByTestId("quiz-score")).toHaveText(/^\d \/ 6$/);
  // Another round starts from the first question.
  await page.getByTestId("quiz-again").click();
  await expect(quiz(page).getByText(/Quiz · 1 \//i)).toBeVisible();
  expect(errors).toEqual([]);
});

test("an answer leads back to the step it comes from", async ({ page }) => {
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/final/`);
  await answer(page);
  const link = page.getByTestId("quiz-step-link");
  const href = await link.getAttribute("href");
  const step = /step=([\w-]+)/.exec(href ?? "")![1]!;
  await link.click();
  await expect(page.getByTestId("simulation-shell")).toHaveAttribute("data-step", step);
});

test("finishing from the last step completes the journey; stamps land once and fill the passport", async ({ page }) => {
  // Two places of the story, then the end.
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/?step=${ismayil.stepIds[4]}`);
  await expect(page.getByTestId("simulation-shell")).toHaveAttribute("data-step", ismayil.stepIds[4]!);
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/?step=${last}`);
  await page.getByTestId("step-final").click();
  await expect(page.getByTestId("final-screen")).toHaveAttribute("data-completed", "true");
  const stamps = page.getByTestId("final-passport").getByTestId("stamp");
  await expect(stamps.first()).toHaveAttribute("data-fresh", "true");
  const count = await stamps.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tarix:progress")!).collection.cards["shah-ismayil"])).toBeTruthy();

  await page.goto("/az/pasport/");
  await expect(page.getByTestId("passport-book").getByTestId("stamp")).toHaveCount(count);
  await expect(page.getByTestId("passport-count")).toContainText(`${count} /`);
  await expect(page.getByTestId("passport-book")).toContainText("Şah İsmayıl Xətai ·");

  // Seen once: on the next visit they are simply there.
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/final/`);
  await expect(page.getByTestId("final-passport").getByTestId("stamp").first()).toHaveAttribute("data-fresh", "false");
});

test("opening the final screen by its address does not complete the journey", async ({ page }) => {
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/final/`);
  await expect(page.getByTestId("final-screen")).toHaveAttribute("data-completed", "false");
  await expect(page.getByTestId("final-passport")).toContainText("möhür vurulacaq");
  await page.goto("/az/pasport/");
  await expect(page.getByText("Pasport səyahət etdikcə dolacaq")).toBeVisible();
});

test("the compare action names the related person in the right case", async ({ page }) => {
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/final/`);
  const compare = page.getByTestId("final-compare");
  await expect(compare).toContainText("Uzun Həsənlə müqayisə et");
  await expect(compare).toHaveAttribute("href", /a=person:shah-ismayil&b=person:uzun-hasan/);
});

test("the portrait follows the age: a placeholder until the AI illustration exists, then a work of the time", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "the portrait card is on the desktop map");
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/?step=ismayil-lahijan-education`);
  const card = page.getByTestId("portrait-card");
  await expect(card).toHaveAttribute("data-kind", "pending");
  await expect(card).toContainText("rəssam təsəvvürü hazırlanır");
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/?step=ismayil-chaldiran`);
  await expect(card).toHaveAttribute("data-kind", "historical");
  await expect(card.getByRole("img")).toBeVisible();
  await expect(card.getByTestId("portrait-kind")).toHaveText("Dövrünün əsəri");
  await card.getByTestId("portrait-info").click();
  await expect(card.getByTestId("portrait-details")).toContainText("Lisenziya: Public domain");
});

test("final and passport pass axe (WCAG 2.2 AA)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one viewport is enough for the rule check");
  await page.goto(`/az/sexsiyyetler/${ismayil.id}/?step=${last}`);
  await page.getByTestId("step-final").click();
  await expect(page.getByTestId("final-quiz")).toBeVisible();
  for (const url of [null, "/az/pasport/"]) {
    if (url) await page.goto(url);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), url ?? "final").toEqual([]);
  }
});
