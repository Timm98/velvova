import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-pb-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/settings`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(2500);
const da = await s.locator('input[type="file"][name="bild"]').count();
console.log("Dateifeld vorhanden:", da > 0);
if (da > 0) {
  await s.setInputFiles('input[type="file"][name="bild"]', "apps/web/public/flaggen/de.webp");
  await s.getByRole("button", { name: /Hochladen|Ersetzen/ }).click();
  await s.waitForTimeout(4000);
  const bild = await s.locator('img[src="/app/profilbild"]').count();
  const geladen = bild > 0 ? await s.locator('img[src="/app/profilbild"]').first().evaluate(i => i.naturalWidth) : 0;
  console.log(`Bild angezeigt: ${bild > 0}, geladen: ${geladen}px breit`);
}
await b.close();
