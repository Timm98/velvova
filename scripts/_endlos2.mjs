import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
s.on("console", m => { if (/Fehler|error/i.test(m.text())) console.log("  [konsole]", m.text().slice(0,90)); });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-e2-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(4000);
const zaehle = () => s.evaluate(() => document.querySelectorAll('[data-job-id], li a[href*="/app/jobs/"]').length);
console.log("anfangs:", await zaehle());
for (let i = 0; i < 4; i++) {
  // realistischer: erst ein Stück hoch, dann in Schritten nach unten
  await s.evaluate(() => window.scrollBy(0, -400));
  await s.waitForTimeout(300);
  for (let k = 0; k < 12; k++) { await s.mouse.wheel(0, 1200); await s.waitForTimeout(250); }
  await s.waitForTimeout(5000);
  console.log(`Runde ${i+1}: ${await zaehle()} Stellen · ${new URL(s.url()).search || "(ohne)"}`);
}
await b.close();
