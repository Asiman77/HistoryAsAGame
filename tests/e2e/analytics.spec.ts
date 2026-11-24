import { expect, test } from "@playwright/test";
import { loadPersons } from "./helpers";

/**
 * Learning events leave the browser only when the build sets NEXT_PUBLIC_ANALYTICS_URL
 * (docs/adr/0020); the default static build sends nothing and skips this test.
 */
const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_URL;

interface Batch {
  sessionId: string;
  events: { type: string; ownerType?: string; ownerSlug?: string; stepKey?: string }[];
}

test("a journey sends anonymous learning events in batches", async ({ page }) => {
  test.skip(!endpoint, "build without NEXT_PUBLIC_ANALYTICS_URL");
  // Beacon bodies are not visible to Playwright: record them on the way out, then send as usual.
  await page.addInitScript(() => {
    const w = window as unknown as { __beacons: string[] };
    w.__beacons = [];
    const send = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (data instanceof Blob) void data.text().then((t) => w.__beacons.push(t));
      return send(url, data);
    };
  });
  const batches = async () =>
    (await page.evaluate(() => (window as unknown as { __beacons: string[] }).__beacons)).map((t) => JSON.parse(t) as Batch);

  const person = loadPersons()[0]!;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/az/sexsiyyetler/${person.id}/`);
  await page.getByTestId("step-next").click();
  await expect(page.getByTestId("simulation-shell")).toHaveAttribute("data-step", person.stepIds[1]!);
  // Closing the page sends what is queued, including that the simulation was left half-way.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  await expect
    .poll(async () => (await batches()).flatMap((b) => b.events.map((e) => e.type)))
    .toEqual(expect.arrayContaining(["simulation_started", "step_viewed", "simulation_abandoned"]));
  const all = await batches();
  const events = all.flatMap((b) => b.events);
  expect(events.filter((e) => e.type === "step_viewed").length).toBeGreaterThanOrEqual(2);
  expect(events.every((e) => !e.ownerSlug || e.ownerSlug === person.id)).toBe(true);
  // One random session id, nothing else that identifies the student.
  expect(new Set(all.map((b) => b.sessionId)).size).toBe(1);
  for (const b of all) expect(Object.keys(b).sort()).toEqual(["events", "sessionId"]);
});
