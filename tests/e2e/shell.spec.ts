import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { collectErrors } from "./helpers";

/** The new SimulationShell on /az/sexsiyyetler/<id>/ (phase 3). Steps are read from data/, never hard-coded. */
interface RawEvent {
  id: string;
  order: number;
  title: { az: string };
  date: { year: number };
  narrative: { az: string };
  factualSummary: { az: string };
  route?: unknown;
  fromLocation?: unknown;
}
const events = (id: string): RawEvent[] =>
  (JSON.parse(fs.readFileSync(path.join("data", "persons", id, "events.json"), "utf8")).events as RawEvent[]).sort((a, b) => a.order - b.order);

const PERSON = "shah-ismayil";
const steps = events(PERSON);
const url = (query = "") => `/az/sexsiyyetler/${PERSON}/${query}`;
const shell = (page: Page) => page.getByTestId("simulation-shell");
const content = (page: Page) => page.getByTestId("step-content");

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a shared ?step= opens that step, with its title, theme and map", async ({ page }) => {
  const errors = collectErrors(page);
  const target = steps[5]!;
  await page.goto(url(`?step=${target.id}`));
  await expect(shell(page)).toHaveAttribute("data-step", target.id);
  await expect(content(page).getByRole("heading", { level: 2 })).toHaveText(target.title.az);
  await expect(page.getByTestId("svg-map")).toHaveAttribute("data-step", "5");
  await expect(page.getByTestId("map-current")).toBeVisible();
  await expect(page.getByTestId("theme-root")).not.toHaveAttribute("data-theme", "default");
  expect(errors).toEqual([]);
});

test("next and previous move one step, keep the address in sync and announce the step", async ({ page }) => {
  await page.goto(url());
  await expect(content(page).getByRole("heading", { level: 2 })).toHaveText(steps[0]!.title.az);
  await page.getByTestId("step-next").click();
  await expect(content(page).getByRole("heading", { level: 2 })).toHaveText(steps[1]!.title.az);
  await expect(page).toHaveURL(new RegExp(`step=${steps[1]!.id}`));
  await expect(page.getByTestId("live-region")).toContainText(steps[1]!.title.az);
  await page.getByTestId("step-prev").click();
  await expect(page).toHaveURL(new RegExp(`step=${steps[0]!.id}`));
});

test("the keyboard drives the steps; arrows inside the mode switch stay with it", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "keyboard layout is the desktop one");
  await page.goto(url(`?step=${steps[2]!.id}`));
  await expect(shell(page)).toHaveAttribute("data-step", steps[2]!.id);
  await page.locator("body").press("ArrowRight");
  await expect(shell(page)).toHaveAttribute("data-step", steps[3]!.id);
  await page.locator("body").press("ArrowLeft");
  await page.locator("body").press("ArrowLeft");
  await expect(shell(page)).toHaveAttribute("data-step", steps[1]!.id);
  // In the radio group the arrow changes the mode, not the step.
  await page.getByRole("radio", { name: "Hekayə" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(shell(page)).toHaveAttribute("data-mode", "learn");
  await expect(shell(page)).toHaveAttribute("data-step", steps[1]!.id);
});

test("clicking next mid-transition skips it: the scene ends complete and the next step starts", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "desktop timing");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(url(`?step=${steps[3]!.id}`));
  await expect(content(page)).toBeVisible();
  const next = page.getByTestId("step-next");
  await next.click();
  await next.click();
  await next.click();
  await expect(shell(page)).toHaveAttribute("data-step", steps[6]!.id);
  await expect(content(page).getByRole("heading", { level: 2 })).toHaveText(steps[6]!.title.az, { timeout: 5000 });
  await expect(page.getByTestId("svg-map")).toHaveAttribute("data-step", "6");
});

test("story mode leads with the narrative, learning mode with facts and open sources", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "mode switch sits in the desktop top bar");
  const s = steps[0]!;
  await page.goto(url(`?step=${s.id}&mode=story`));
  await expect(page.getByTestId("narrative")).toContainText(s.narrative.az.slice(0, 30));
  await page.getByRole("radio", { name: "Öyrənmə" }).click();
  await expect(page).toHaveURL(/mode=learn/);
  await expect(page.getByTestId("narrative")).toHaveCount(0);
  await expect(page.getByTestId("summary")).toContainText(s.factualSummary.az.slice(0, 30));
  await expect(page.getByTestId("sources")).toHaveAttribute("open", "");
  // The choice is remembered for the next visit.
  await page.reload();
  await expect(shell(page)).toHaveAttribute("data-mode", "learn");
});

test("the timeline jumps to any step and marks the current one", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "the phone layout has the sheet instead");
  await page.goto(url());
  const timeline = page.getByTestId("shell-timeline");
  await timeline.getByRole("button", { name: new RegExp(steps[8]!.title.az) }).click();
  await expect(shell(page)).toHaveAttribute("data-step", steps[8]!.id);
  await expect(timeline.locator('[aria-current="step"]')).toContainText(steps[8]!.title.az);
});

test("the last step leads to the final screen", async ({ page }) => {
  await page.goto(url(`?step=${steps.at(-1)!.id}`));
  await expect(page.getByTestId("step-final")).toHaveAttribute("href", new RegExp(`/sexsiyyetler/${PERSON}/final/$`));
});

test("phones get the bottom sheet with three states and a top bar over the map", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) >= 1024, "phone and tablet layout");
  await page.goto(url(`?step=${steps[4]!.id}`));
  const sheet = page.getByTestId("bottom-sheet");
  await expect(sheet).toHaveAttribute("data-snap", "half");
  await expect(page.getByTestId("mobile-year")).toContainText(String(steps[4]!.date.year));
  await sheet.getByRole("button", { name: "Paneli böyüt" }).click();
  await expect(sheet).toHaveAttribute("data-snap", "full");
  await sheet.getByRole("button", { name: "Paneli kiçilt" }).click();
  await expect(sheet).toHaveAttribute("data-snap", "half");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveAttribute("data-snap", "peek");
  await page.getByTestId("step-next").click();
  await expect(shell(page)).toHaveAttribute("data-step", steps[5]!.id);
});

test("the shell passes axe (WCAG 2.2 AA) and the map carries its schematic note", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one viewport is enough for the rule check");
  await page.goto(url(`?step=${steps[10]!.id}`));
  await expect(content(page)).toBeVisible();
  await expect(page.getByTestId("map-note")).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("progress is saved for the home cards", async ({ page }) => {
  await page.goto(url(`?step=${steps[6]!.id}`));
  await expect(shell(page)).toHaveAttribute("data-step", steps[6]!.id);
  await expect
    .poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem("tarix:progress") ?? "{}").persons?.[id]?.index, PERSON))
    .toBe(6);
});
