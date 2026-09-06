import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Kommen die Firmendaten beim Menschen an?
 *
 * 500 € im Monat rechtfertigen sich nicht dadurch, dass Spalten
 * gefüllt sind, sondern dadurch, dass jemand sie liest.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const [stelle] = (await db.execute(sql`
  select j.id, j.title, c.name firma, c.mitarbeiter, c.industry
  from jobs j join companies c on c.id = j.company_id
  where c.mitarbeiter is not null and c.industry is not null and j.is_demo = false
  limit 1`)).rows;
if (!stelle) { console.log("  !!  Keine angereicherte Firma gefunden."); process.exit(1); }

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(300000); p.setDefaultNavigationTimeout(300000);
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`fd-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 90000 });

console.log(`  Stelle: „${String(stelle.title).slice(0, 44)}" bei ${stelle.firma}`);
console.log(`  Erwartet: ${stelle.mitarbeiter} · ${stelle.industry}\n`);
await p.goto(`${B}/app/jobs/${stelle.id}`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 60000 }).catch(() => {});
const t = (await p.locator("main").innerText()).replace(/\s+/g, " ");

zeile(t.includes(String(stelle.firma).slice(0, 20)), "Der Firmenname steht da");
zeile(/Mitarbeitende|Einzelperson/.test(t), "Die Betriebsgrösse steht dabei");
zeile(t.includes(String(stelle.industry).slice(0, 14)), `Die Branche steht dabei („${String(stelle.industry).slice(0, 22)}")`);
zeile(!/employees/i.test(t), "Und zwar auf Deutsch, nicht als „employees“");

await b.close();
console.log(fehler === 0 ? "\nAlle Prüfungen bestanden." : `\n${fehler} fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
