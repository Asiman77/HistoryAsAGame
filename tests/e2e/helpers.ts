import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const root = path.join(process.cwd(), "data", "persons");

export interface PersonFixture {
  id: string;
  name: string;
  titles: string[];
  hasQuiz: boolean;
  hasChoice: boolean;
  /** Index of the first stage with a choice moment, -1 if none. */
  firstChoice: number;
  /** Index of the first stage that moves the person (draws a route). */
  firstMove: number;
}

interface RawEvent {
  order: number;
  title: { az: string };
  quiz?: unknown[];
  choice?: unknown;
  fromLocation?: unknown;
}

/** Reads persons straight from data/, so new persons are covered automatically. */
export function loadPersons(): PersonFixture[] {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const person = JSON.parse(fs.readFileSync(path.join(root, d.name, "person.json"), "utf8"));
      const events: RawEvent[] = JSON.parse(fs.readFileSync(path.join(root, d.name, "events.json"), "utf8")).events;
      events.sort((a, b) => a.order - b.order);
      return {
        id: person.id,
        name: person.name.az,
        titles: events.map((e) => e.title.az),
        hasQuiz: events.some((e) => e.quiz?.length),
        hasChoice: events.some((e) => e.choice),
        firstChoice: events.findIndex((e) => e.choice),
        firstMove: events.findIndex((e, i) => i > 0 && e.fromLocation),
      };
    });
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Hiccups of the public tile server are not app errors.
    if (m.type() === "error" && !/Failed to load resource|openfreemap/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** The journey starts behind a "Hekayəyə başla" gate (it unlocks audio). */
export async function startJourney(page: Page, button: string | RegExp = "Hekayəyə başla") {
  // The gate is in the static HTML, so a click can land before hydration; retry until it closes.
  const gate = page.locator("#start-title");
  await expect(async () => {
    if ((await gate.count()) === 0) return;
    await page.getByRole("button", { name: button }).click({ timeout: 3000 });
    await expect(gate).toHaveCount(0, { timeout: 4000 });
  }).toPass({ timeout: 30_000 });
}
