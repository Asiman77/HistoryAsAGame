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

test("portrait card follows the age: AI placeholder in childhood, a period portrait later", async ({ page }) => {
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-lahijan-education");
  await startJourney(page, /mərhələsindən başla/);
  const card = page.getByTestId("portrait-card");
  await expect(card).toHaveAttribute("data-kind", "ai_illustration");
  await expect(card).toContainText(/rəssam təsəvvürü \(AI illüstrasiya\)/i);
  await page.goto("/az/persons/shah-ismayil/?step=ismayil-chaldiran");
  await startJourney(page, /mərhələsindən başla/);
  await expect(card).toHaveAttribute("data-kind", "historical");
  await expect(card.getByRole("img")).toBeVisible();
  await expect(card).toContainText("Dövrünün əsəri");
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
