import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Bekommt eine Fahrerstelle eine Fahreraufgabe?
 *
 * Der Fall aus der Vorgabe: Bei einer Lieferfahrer-Stelle darf keine
 * Warmwasser-Aufgabe erscheinen.
 */
const proben = [];
for (const [name, gruppe] of [["Fahrzeugführung", "52"], ["Gebäudetechnik", "34"], ["Pflege", "81"]]) {
  const [j] = (await db.execute(sql`
    select id, title from jobs where country='DE' and left(kldb, 2) = ${gruppe}
    order by id limit 1`)).rows;
  if (j) proben.push({ name, gruppe, ...j });
}

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-probe-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

for (const p of proben) {
  await s.goto(`${BASIS}/app/jobs/${p.id}/probe`);
  await s.waitForLoadState("networkidle");
  const t = await s.locator("main").innerText();
  /* Der Aufgabentitel steht in der h2 der Probenkarte. */
  const h2 = await s.locator("main h2").allInnerTexts();
  const aufgabentitel = h2.find((x) => !/WOFÜR DAS ZÄHLT/i.test(x)) ?? "—";
  console.log(`${p.name.padEnd(18)} (${p.gruppe})  ${String(p.title).slice(0, 34)}`);
  console.log(`   Aufgabe: „${aufgabentitel}"`);
  console.log(`   Warmwasser erwähnt: ${/warmwasser|heizung|kessel|vordruck/i.test(t)}`);
}
await b.close();
