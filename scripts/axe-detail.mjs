import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Welche Elemente genau axe beanstandet.
 *
 * Der Testbericht nennt nur die Anzahl. Für die Behebung braucht man den
 * Selektor und die gemessenen Werte — sonst sucht man die Stelle von
 * Hand.
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const paths = process.argv.slice(2);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

// Anmelden nur, wenn App-Seiten geprüft werden: die Landingpage leitet
// angemeldet auf /app um, und dann misst man die falsche Seite.
if (paths.some((p) => p.startsWith("/app"))) {
  await page.goto(`${BASE}/api/dev/login`);
}

for (const path of paths) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  console.log(`\n=== ${path} — ${serious.length} Regeln ===`);
  for (const v of serious) {
    console.log(`\n[${v.id}] ${v.help}`);
    for (const node of v.nodes) {
      console.log(`  ${node.target.join(" ")}`);
      console.log(`    ${node.failureSummary?.split("\n").slice(1).join(" | ")}`);
    }
  }
}

await browser.close();
