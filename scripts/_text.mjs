import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
const p = await ctx.newPage();
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`txt-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
for (const pfad of process.argv.slice(2)) {
  await p.goto(`${B}${pfad}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ").trim();
  console.log(`\n── ${pfad} ──\n${t.slice(0, 700)}`);
}
await b.close();
