import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ locale: "de-DE" });
const p = await ctx.newPage();
p.setDefaultTimeout(120000); p.setDefaultNavigationTimeout(120000);
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`sz-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 120000 });

// Serverzeit über die reine Antwort messen, ohne Rendern
for (const pfad of ["/app/jobs", "/app/jobs"]) {
  const t = Date.now();
  const r = await p.request.get(`${B}${pfad}`);
  const bytes = (await r.body()).length;
  console.log(`  ${pfad.padEnd(12)} Serverantwort ${Date.now() - t} ms · ${(bytes / 1024).toFixed(0)} KB`);
}
// Und die volle Seite zum Vergleich
const t2 = Date.now();
await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
console.log(`  Vollständig geladen: ${Date.now() - t2} ms`);
await b.close();
process.exit(0);
