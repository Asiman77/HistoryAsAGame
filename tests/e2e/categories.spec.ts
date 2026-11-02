import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("home shows the three sections and each opens its own page", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/");
  for (const [name, url] of [
    ["Tarixi şəxsiyyətlər", "/az/persons/"],
    ["Döyüşlər və müharibələr", "/az/conflicts/"],
    ["Dövlətlər", "/az/states/"],
  ] as const) {
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.getByRole("link", { name: /Ana səhifə/ }).click();
    await expect(page).toHaveURL(/\/az\/$/);
  }
  expect(errors).toEqual([]);
});

test("planned and built simulations are listed on their section pages", async ({ page }) => {
  await page.goto("/az/conflicts/");
  await expect(page.getByRole("heading", { name: "44 günlük Vətən müharibəsi" })).toBeVisible();
  await expect(page.getByText("Tezliklə").first()).toBeVisible();
  await page.goto("/az/states/");
  await expect(page.getByRole("link", { name: /Əfşarlar dövləti/ })).toBeVisible();
});

test("old person URLs redirect and keep the deep link", async ({ page }) => {
  await page.goto("/az/person/shah-ismayil/?step=ismayil-chaldiran");
  await expect(page).toHaveURL(/\/az\/persons\/shah-ismayil\/\?step=ismayil-chaldiran/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Çaldıran döyüşü" })).toBeVisible();
});

test("refs to missing entities are passive; person links return to where you were", async ({ page }) => {
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-chaldiran");
  await startJourney(page, /mərhələsindən başla/);
  // Çaldıran döyüşü and Osmanlı dövləti have no simulation yet.
  const passive = page.locator('[data-passive="true"]', { hasText: "Çaldıran döyüşü (1514)" });
  await expect(passive).toContainText("tezliklə");
  await expect(page.getByRole("link", { name: /Çaldıran döyüşü \(1514\)/ })).toHaveCount(0);

  // Cross into Uzun Həsən's story and come back.
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").first().click();
  await page.locator("article").getByRole("link", { name: /Uzun Həsən: Trabzon şahzadəsi ilə nikah/ }).click();
  await expect(page).toHaveURL(/\/az\/persons\/uzun-hasan\/\?step=uzun-hasan-despina/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Trabzon şahzadəsi ilə nikah" })).toBeVisible();
  const back = page.getByTestId("return-link");
  await expect(back).toContainText("Şah İsmayıl Xətai · Ərdəbildə doğuluş");
  await back.click();
  await expect(page).toHaveURL(/\/az\/persons\/shah-ismayil\/\?step=ismayil-birth/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Ərdəbildə doğuluş" })).toBeVisible();
});

test("ruler panel: clicking a state in the legend shows who rules it that year", async ({ page, viewport }) => {
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-chaldiran");
  await startJourney(page, /mərhələsindən başla/);
  const legend = page.getByTestId("map-legend");
  if ((viewport?.width ?? 0) < 1024) await legend.getByRole("button", { name: "Xəritə açarını göstər" }).click();
  await legend.getByRole("button", { name: "Osmanlı dövləti" }).click();
  const panel = page.getByTestId("polity-panel");
  await expect(panel.getByText("I Səlim", { exact: true })).toBeVisible();
  await expect(panel.getByText("Bu mərhələdə rəqib tərəfdir: Osmanlı ordusu.")).toBeVisible();
  await expect(panel.getByText("İstanbul")).toBeVisible();
  await panel.getByRole("button", { name: "Bağla" }).click();

  // Same state, other year: the ruler comes from the reign table, not from the event.
  if ((viewport?.width ?? 0) < 1024) await legend.getByRole("button", { name: "Xəritə açarını göstər" }).click();
  await page.getByRole("navigation", { name: "Həyat xətti" }).getByRole("button").first().click();
  await legend.getByRole("button", { name: "Osmanlı dövləti" }).click();
  await expect(panel.getByText("II Bayezid", { exact: true })).toBeVisible();
});

test("ruler panel opens from a click on the map", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 1024, "the map is covered by the bottom sheet below 1024px");
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-coronation");
  await startJourney(page, /mərhələsindən başla/);
  const panel = page.getByTestId("polity-panel");
  // The camera settles on Tabriz, inside the Safavid state.
  await expect(async () => {
    const box = (await page.locator(".maplibregl-canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.58);
    await expect(panel).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect(panel.getByText("Bu dövlətin hökmdarı sənsən.")).toBeVisible();
});

test("states without data say so instead of staying empty", async ({ page, viewport }) => {
  await page.goto("/az/persons/uzun-hasan/?step=uzun-hasan-sara-khatun");
  await startJourney(page, /mərhələsindən başla/);
  const legend = page.getByTestId("map-legend");
  if ((viewport?.width ?? 0) < 1024) await legend.getByRole("button", { name: "Xəritə açarını göstər" }).click();
  await legend.getByRole("button", { name: "Trabzon imperiyası" }).click();
  await expect(page.getByTestId("polity-panel").getByText(/tezliklə əlavə olunacaq/)).toBeVisible();
});

test("state simulation: Əfşarlar from Muğan to the end, with the dynasty strip", async ({ page }) => {
  test.slow(); // 15 animated stages
  const errors = collectErrors(page);
  await page.goto("/az/states/");
  await page.getByRole("link", { name: /Əfşarlar dövləti/ }).click();
  await expect(page).toHaveURL(/\/az\/states\/afshar\/$/);
  await startJourney(page);
  await expect(page.getByRole("heading", { level: 2, name: "Səfəvi böhranı: İsfahanın süqutu" })).toBeVisible();
  await expect(page.getByTestId("dynasty-strip")).toBeVisible();
  const next = page.getByRole("button", { name: /Növbəti|İrs və nəticə/ }).first();
  for (let i = 0; i < 15; i++) await next.click();
  await expect(page.getByRole("heading", { level: 2, name: "Əfşarlar dövləti" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Nadir Şah's coronation links to the state simulation and back", async ({ page }) => {
  await page.goto("/az/persons/nadir-shah/?step=nadir-mughan");
  await startJourney(page, /mərhələsindən başla/);
  await page.locator("article").getByRole("link", { name: /Əfşarlar dövləti/ }).click();
  await expect(page).toHaveURL(/\/az\/states\/afshar\/\?step=1736-mughan/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Muğan qurultayı: Əfşarlar dövləti" })).toBeVisible();
  await page.getByTestId("return-link").click();
  await expect(page).toHaveURL(/\/az\/persons\/nadir-shah\/\?step=nadir-mughan/);
});
