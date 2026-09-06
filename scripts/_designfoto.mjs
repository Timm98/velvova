import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1440, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-des-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 120000 });
await s.waitForTimeout(3500);
for (const thema of ["light","dark"]) {
  await s.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
  await s.waitForTimeout(900);
  await s.screenshot({ path: `/tmp/design-${thema}.png` });
  const d = await s.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { bg: cs.backgroundColor, schrift: cs.fontFamily.split(",")[0] };
  });
  console.log(`${thema}: Grund ${d.bg}, Schrift ${d.schrift}`);
}
await b.close();
