import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-DE" }).then(c => c.newPage());
p.setDefaultTimeout(240000); p.setDefaultNavigationTimeout(240000);
const zeit = async (name, pfad) => {
  const t = Date.now();
  try { await p.goto(`${B}${pfad}`, { waitUntil: "domcontentloaded" }); console.log(`  ${name.padEnd(20)} ${Date.now() - t} ms`); }
  catch { console.log(`  ${name.padEnd(20)} ZEITGRENZE nach ${Date.now() - t} ms`); }
};
await zeit("Startseite", "/");
await zeit("Registrierung", "/register");
await p.getByLabel("E-Mail-Adresse").fill(`wo-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
const t0 = Date.now();
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 240000 }).catch(() => {});
console.log(`  ${"Konto anlegen".padEnd(20)} ${Date.now() - t0} ms → ${p.url().replace(B, "")}`);
await zeit("Übersicht /app", "/app");
await zeit("Liste /app/jobs", "/app/jobs");
// Eine echte Stelle öffnen
const href = await p.locator("[data-job-id]").first().getAttribute("data-job-id").catch(() => null);
if (href) await zeit("Detailseite", `/app/jobs/${href}`);
else console.log("  Detailseite         keine Stelle in der Liste gefunden");
await b.close();
