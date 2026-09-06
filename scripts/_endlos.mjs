import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: B, viewport: { width: 1280, height: 900 } });
await s.goto(`${B}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-endlos-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 60000 });
await s.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded", timeout: 180000 });
await s.waitForTimeout(4000);
const zaehle = () => s.evaluate(() => document.querySelectorAll('[data-job-id], li a[href*="/app/jobs/"]').length);
console.log("Stellen anfangs:", await zaehle());
for (let i = 0; i < 3; i++) {
  await s.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await s.waitForTimeout(6000);
  const knopf = await s.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => /Weitere|geladen/.test(x.textContent));
    return b ? b.textContent.trim().slice(0, 40) : "KEIN KNOPF";
  });
  console.log(`nach Scrollen ${i+1}: ${await zaehle()} Stellen · ${new URL(s.url()).search || "(keine Parameter)"} · Knopf: ${knopf}`);
}
await b.close();
