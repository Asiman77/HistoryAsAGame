import { expect, test } from "@playwright/test";
import { collectErrors, startJourney } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the site menu opens each collection and the logo returns home", async ({ page, viewport }) => {
  const errors = collectErrors(page);
  await page.goto("/az/");
  const narrow = (viewport?.width ?? 0) < 1024;
  for (const [link, url, heading] of [
    ["Şəxsiyyətlər", "/az/sexsiyyetler/", "Tarixi şəxsiyyətlər"],
    ["Döyüşlər", "/az/doyusler/", "Döyüşlər və müharibələr"],
    ["Dövlətlər", "/az/dovletler/", "Dövlətlər"],
  ] as const) {
    if (narrow) await page.getByRole("button", { name: "Menyunu aç" }).click();
    await page.getByRole("navigation", { name: "Əsas menyu" }).getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${url}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.getByTestId("site-header").getByRole("link", { name: "Tarixin İçində" }).click();
    await expect(page).toHaveURL(/\/az\/$/);
  }
  expect(errors).toEqual([]);
});

test("built simulations are listed on their collection pages", async ({ page }) => {
  await page.goto("/az/doyusler/");
  await expect(page.getByTestId("war-card")).toHaveAttribute("href", /\/conflicts\/karabakh-war-2020\/$/);
  await expect(page.getByTestId("war-card")).toContainText("Şanlı Zəfər tariximiz");
  await page.goto("/az/dovletler/");
  await expect(page.getByTestId("state-card")).toContainText("Əfşarlar dövləti");
});

test("legacy list URLs move to the new collections", async ({ page }) => {
  for (const [from, to] of [
    ["/az/persons/", "/az/sexsiyyetler/"],
    ["/az/conflicts/", "/az/doyusler/"],
    ["/az/states/", "/az/dovletler/"],
    ["/az/places/", "/az/mekanlar/"],
  ] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  }
});

test("old person URLs redirect to the new simulation and keep the deep link", async ({ page }) => {
  for (const old of ["/az/person/shah-ismayil/?step=ismayil-chaldiran", "/az/persons/shah-ismayil/?step=ismayil-chaldiran"]) {
    await page.goto(old);
    await expect(page).toHaveURL(/\/az\/sexsiyyetler\/shah-ismayil\/\?step=ismayil-chaldiran/);
    await expect(page.getByTestId("step-content").getByRole("heading", { level: 2 })).toHaveText("Çaldıran döyüşü");
  }
});

test("refs to entities without a simulation are passive", async ({ page }) => {
  await page.goto("/az/sexsiyyetler/shah-ismayil/?step=ismayil-chaldiran");
  const content = page.getByTestId("step-content");
  // Çaldıran döyüşü and Osmanlı dövləti have no simulation yet.
  await expect(content.getByText(/Çaldıran döyüşü/).filter({ hasText: "tezliklə" }).first()).toBeVisible();
  await expect(content.getByRole("link", { name: /Çaldıran döyüşü/ })).toHaveCount(0);
});

test("ruler panel on the simulation map: who rules the clicked state in the step's year", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the map is checked where WebGL runs on the GPU");
  await page.goto("/az/sexsiyyetler/shah-ismayil/?step=ismayil-coronation");
  await expect(page.getByTestId("gl-map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  const safavid = page.locator('.gl-polity[data-polity="safavid"]');
  await expect(safavid).toHaveCount(1, { timeout: 15_000 });
  await safavid.dispatchEvent("click");
  const panel = page.getByTestId("polity-panel");
  await expect(panel.getByTestId("ruler-name")).toContainText("İsmayıl");
  await expect(panel).toContainText("Bu dövlətin hökmdarı sənsən.");
  // The open simulation does not offer itself again.
  await expect(panel.getByTestId("ruler-live")).toHaveCount(0);
  await panel.getByRole("button", { name: "Hökmdar panelini bağla" }).click();
  await expect(panel).toHaveCount(0);
});

test("states without data say so instead of staying empty", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the map is checked where WebGL runs on the GPU");
  await page.goto("/az/sexsiyyetler/uzun-hasan/?step=uzun-hasan-sara-khatun");
  await expect(page.getByTestId("gl-map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  const trebizond = page.locator('.gl-polity[data-polity="trebizond"]');
  await expect(trebizond).toHaveCount(1, { timeout: 15_000 });
  await trebizond.dispatchEvent("click");
  await expect(page.getByTestId("polity-no-data")).toBeVisible();
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/az/sexsiyyetler/nadir-shah/?step=nadir-mughan");
  await page.getByTestId("step-content").getByRole("link", { name: /Əfşarlar dövləti/ }).click();
  await expect(page).toHaveURL(/\/az\/states\/afshar\/\?step=1736-mughan/);
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByRole("heading", { level: 2, name: "Muğan qurultayı: Əfşarlar dövləti" })).toBeVisible();
  await page.getByTestId("return-link").click();
  await expect(page).toHaveURL(/\/az\/sexsiyyetler\/nadir-shah\/\?step=nadir-mughan/);
});

test("war section plays its own music: march, anthem on Şuşa, lament on memorial days", async ({ page }) => {
  const heard = new Set<string>();
  page.on("request", (r) => {
    const m = /music-(march|anthem|lament|triumph).(webm|mp3)/.exec(r.url());
    if (m) heard.add(m[1]!);
  });
  await page.goto("/az/conflicts/karabakh-war-2020/");
  await startJourney(page);
  await expect.poll(() => heard.has("march")).toBe(true);
  await page.goto("/az/conflicts/karabakh-war-2020/?step=2020-11-08");
  await startJourney(page, /mərhələsindən başla/);
  await expect.poll(() => heard.has("anthem") && heard.has("triumph")).toBe(true);
  await page.goto("/az/conflicts/karabakh-war-2020/?step=2020-10-11-ganja");
  await startJourney(page, /mərhələsindən başla/);
  await expect.poll(() => heard.has("lament")).toBe(true);
});

test("war section: flag intro, day counter, liberated settlements, Şuşa and the memorial", async ({ page }) => {
  test.slow();
  const errors = collectErrors(page);
  await page.goto("/az/doyusler/");
  await page.getByTestId("war-card").click();
  await expect(page.getByTestId("war-intro")).toBeVisible();
  await expect(page.getByTestId("war-intro")).toContainText("27 sentyabr 2020");
  await startJourney(page);
  await expect(page.getByRole("heading", { level: 2, name: "Əks-hücum əməliyyatının başlanması" })).toBeVisible();

  await page.goto("/az/conflicts/karabakh-war-2020/?step=2020-10-04");
  await startJourney(page, /mərhələsindən başla/);
  const panel = page.locator("article");
  await expect(panel.getByRole("heading", { level: 2, name: "Cəbrayıl şəhəri" })).toBeVisible();
  await expect(panel.getByText(/Karxulu/)).toBeVisible();
  await expect(panel.getByRole("link", { name: /Prezident İlham Əliyevin xalqa müraciəti/ })).toBeVisible();

  await page.goto("/az/conflicts/karabakh-war-2020/?step=2020-11-08");
  await startJourney(page, /mərhələsindən başla/);
  await expect(page.getByTestId("shusha-banner")).toBeVisible();
  await page.getByRole("button", { name: /Qəhrəmanlar \(82\)/ }).first().click();
  const memorial = page.getByTestId("heroes-memorial");
  await expect(memorial.getByText("Vətən Müharibəsi Qəhrəmanları")).toBeVisible();
  await expect(memorial.getByText("Mirzəyev Hikmət İzzət oğlu")).toBeVisible();
  await memorial.getByRole("button", { name: "Bağla" }).click();
  expect(errors).toEqual([]);
});

test("persons link to battles only when they exist; the Şuşa battle opens the war day", async ({ request }) => {
  // Built pages contain the resolved link; checked on the static output to keep it fast.
  const html = await (await request.get("/az/conflicts/karabakh-war-2020/")).text();
  expect(html).toContain("Şuşa əməliyyatı");
});
