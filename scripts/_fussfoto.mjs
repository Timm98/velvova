import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-fuss2-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(2500);
await s.locator("footer").scrollIntoViewIfNeeded();
await s.waitForTimeout(2500);
for (const thema of ["light","dark"]) {
  await s.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
  await s.waitForTimeout(800);
  await s.locator("footer").screenshot({ path: `/tmp/fuss-${thema}.png` });
}
console.log("Fussbilder erzeugt");
await b.close();
