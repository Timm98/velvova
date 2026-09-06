import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-bdg-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/faq`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(2500);
await s.locator(".zahlungsarten").scrollIntoViewIfNeeded();
await s.waitForTimeout(2500);
for (const thema of ["light","dark"]) {
  await s.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
  await s.waitForTimeout(700);
  const bg = await s.evaluate(() => getComputedStyle(document.querySelector(".zahlungsbadge")).backgroundColor);
  console.log(`${thema}: Badge-Grund ${bg}`);
  await s.locator("section[aria-labelledby='zahlungsarten']").screenshot({ path: `/tmp/badge-${thema}.png` });
}
await b.close();
