import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a legend step is marked, explains itself and shows where it was first recorded", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/az/sexsiyyetler/nadir-shah/?step=nadir-captivity&mode=learn");
  const content = page.getByTestId("step-content");
  await expect(content.locator('[data-claim="legend"]').first()).toBeVisible();
  // Learning mode opens "Ətraflı" with the statements of the step.
  const list = page.getByTestId("claim-list");
  await expect(list).toContainText("İlk qeyd");
  await expect(list).toContainText("Versiyalar");
  // The badge explains the kind on click or tap.
  await list.locator('[data-claim="legend"]').first().click();
  await expect(page.getByRole("note").filter({ hasText: "Bu niyə rəvayət sayılır?" }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("disputed statements open their alternative versions", async ({ page }) => {
  // Disputed statements are read from data, so the step is found there rather than named.
  const fs = await import("node:fs");
  const events = JSON.parse(fs.readFileSync("data/persons/shah-ismayil/events.json", "utf8")).events as { id: string; claims?: { claimType: string }[] }[];
  const step = events.find((e) => e.claims?.some((c) => c.claimType === "disputed"));
  test.skip(!step, "no disputed statement in the data");
  await page.goto(`/az/sexsiyyetler/shah-ismayil/?step=${step!.id}`);
  const alt = page.getByTestId("alt-versions");
  await expect(alt).toHaveAttribute("open", "");
  await expect(alt).toContainText("Versiyalar");
});

test("legends can be hidden in the settings and opened on demand", async ({ page }) => {
  await page.goto("/az/sexsiyyetler/shah-ismayil/?step=ismayil-flight-gilan&mode=learn");
  await page.evaluate(() => {
    const raw = localStorage.getItem("tarix:settings");
    localStorage.setItem("tarix:settings", JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), showLegends: false }));
  });
  await page.reload();
  const list = page.getByTestId("claim-list");
  await expect(list.locator("[data-claim-id=ismayil-gilan-refuge]")).toBeVisible();
  await expect(list.locator("[data-claim-id=ismayil-basket-oath]")).toHaveCount(0);
  await page.getByTestId("show-hidden-legends").click();
  await expect(list.locator("[data-claim-id=ismayil-basket-oath]")).toBeVisible();
});
