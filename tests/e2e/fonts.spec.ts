import { expect, test } from "@playwright/test";

/**
 * Both design fonts carry the whole Azerbaijani alphabet (FRONTEND_SPEC §3.3).
 * A glyph the font lacks would be drawn by the next family in the stack, so
 * each letter is measured with two different fallbacks: equal widths mean
 * the font itself drew it.
 */
const LETTERS = [..."əƏğĞıİöÖüÜçÇşŞ"];

test("Noto Serif Display and Inter draw every Azerbaijani letter", async ({ page }) => {
  await page.goto("/az/");
  const missing = await page.evaluate(async (letters) => {
    const html = getComputedStyle(document.documentElement);
    const first = (v: string) => v.split(",")[0]!.trim();
    const families = [first(html.getPropertyValue("--font-noto-serif-display")), first(html.getPropertyValue("--font-inter"))];
    const out: string[] = [];
    for (const family of families) {
      if (!family) {
        out.push("(font variable missing)");
        continue;
      }
      for (const style of ["normal", "italic"]) {
        await document.fonts.load(`${style} 40px ${family}`, letters.join(""));
        for (const ch of letters) {
          const widths = ["monospace", "cursive"].map((fallback) => {
            const span = document.createElement("span");
            span.textContent = ch;
            span.style.cssText = `font: ${style} 40px ${family}, ${fallback}; position: absolute; visibility: hidden; white-space: pre`;
            document.body.append(span);
            const w = span.getBoundingClientRect().width;
            span.remove();
            return w;
          });
          if (Math.abs(widths[0]! - widths[1]!) > 0.01) out.push(`${family} ${style} ${ch}`);
        }
      }
    }
    return out;
  }, LETTERS);
  expect(missing).toEqual([]);
});
