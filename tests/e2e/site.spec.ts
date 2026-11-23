import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { collectErrors, loadPersons } from "./helpers";

const persons = loadPersons();

/** Every route of the new design built in phase 2 (FRONTEND_PLAN §3). */
const NEW_ROUTES = [
  "/az/",
  "/az/kurikulum/",
  "/az/kurikulum/8/",
  "/az/zaman/",
  "/az/sexsiyyetler/",
  `/az/sexsiyyetler/${persons[0]!.id}/`,
  `/az/sexsiyyetler/${persons[0]!.id}/final/`,
  "/az/doyusler/",
  "/az/doyusler/karabakh-war-2020/",
  "/az/doyusler/karabakh-war-2020/gun/",
  "/az/dovletler/",
  "/az/dovletler/afshar/",
  "/az/mekanlar/",
  "/az/mekanlar/tebriz/",
  "/az/muqayise/",
  "/az/pasport/",
  "/az/muellim/",
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("every new route opens without errors and passes axe (WCAG 2.2 AA)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one viewport is enough for the rule check");
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  for (const url of NEW_ROUTES) {
    await page.goto(url);
    await expect(page.getByTestId("theme-root"), url).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first(), url).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(
      result.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      url,
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("the header marks the current section and the skip link jumps to the content", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "desktop menu");
  await page.goto("/az/sexsiyyetler/");
  const nav = page.getByRole("navigation", { name: "Əsas menyu" });
  await expect(nav.getByRole("link", { name: "Şəxsiyyətlər" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Döyüşlər" })).not.toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Məzmuna keç" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("on phones the sections fold into a menu that Escape closes", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) >= 1024, "phone and tablet menu");
  await page.goto("/az/");
  const button = page.getByRole("button", { name: "Menyunu aç" });
  await button.click();
  const menu = page.getByRole("navigation", { name: "Əsas menyu" });
  await expect(menu.getByRole("link", { name: "Məkanlar" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await button.click();
  await menu.getByRole("link", { name: "Məkanlar" }).click();
  await expect(page).toHaveURL(/\/az\/mekanlar\/$/);
  await expect(page.getByRole("navigation", { name: "Əsas menyu" })).toHaveCount(0);
});

test("moving between pages changes the period theme of the same design root", async ({ page }) => {
  await page.goto("/az/");
  const root = page.getByTestId("theme-root");
  await expect(root).toHaveAttribute("data-theme", "default");
  await expect(page.locator("html")).toHaveClass(/\bds\b/);
  await page.goto("/az/doyusler/");
  await expect(root).toHaveAttribute("data-theme", "muasir-zefer");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "muasir-zefer");
  // Client navigation back home keeps the root and returns to the default theme.
  await page.getByTestId("site-header").getByRole("link", { name: "Tarixin İçində" }).click();
  await expect(page).toHaveURL(/\/az\/$/);
  await expect(root).toHaveAttribute("data-theme", "default");
});

test("cards wear their own period and person cards show the viewer's progress", async ({ page }) => {
  await page.goto("/az/");
  await page.evaluate((id) => {
    localStorage.setItem("tarix:progress", JSON.stringify({ persons: { [id]: { index: 6, phase: "journey", choices: {}, furthest: 6, completed: false, updatedAt: 1 } }, collection: { cards: {}, quizBadges: {} } }));
  }, persons[0]!.id);
  await page.reload();
  const card = page.getByTestId("person-card").filter({ hasText: persons[0]!.name });
  await expect(card).toContainText(`Davam et · 7/${persons[0]!.titles.length}`);
  await expect(page.locator('[data-theme="muasir-zefer"]').getByTestId("war-card")).toBeVisible();
});

test("the curriculum opens the grade chosen last", async ({ page }) => {
  await page.goto("/az/kurikulum/9/");
  await expect(page.getByRole("heading", { level: 1, name: "9-cu sinif" })).toBeVisible();
  await expect(page.getByRole("link", { name: "9-cu sinfin mövzuları" })).toHaveAttribute("aria-current", "page");
  await page.goto("/az/kurikulum/");
  await expect(page).toHaveURL(/\/az\/kurikulum\/9\/$/);
  expect(await page.evaluate(() => localStorage.getItem("tarix:prefs"))).toBe('{"lastGrade":9}');
});

test("skeleton screens name their subject from data and link to the page that serves it today", async ({ page }) => {
  await page.goto("/az/dovletler/afshar/");
  await expect(page.getByRole("heading", { level: 1, name: "Əfşarlar dövləti" })).toBeVisible();
  await page.getByRole("link", { name: /Hazırkı versiyada aç/ }).click();
  await expect(page).toHaveURL(/\/az\/states\/afshar\/$/);
});
