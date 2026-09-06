import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
/* Eine englische Stelle aus einer Quelle, deren Volltext wir zeigen
   dürfen — sonst gibt es nichts zu übersetzen. */
const [q] = (await db.execute(sql`select id from job_sources where key = 'arbeitnow'`)).rows;
const [en] = (await db.execute(sql`
  select j.id, j.title from job_source_links l
  join jobs j on j.id = l.job_id
  where l.source_id = ${q.id}::uuid and j.original_language = 'en'
    and length(j.description) between 400 and 6000 limit 1`)).rows;
const [de] = (await db.execute(sql`
  select id, title from jobs where country='DE' and original_language='de'
    and length(description) > 400 order by id limit 1`)).rows;
console.log("englische Stelle:", en ? String(en.title).slice(0, 46) : "keine gefunden");
console.log("deutsche Stelle: ", de ? String(de.title).slice(0, 46) : "—");
if (!en) process.exit(0);

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-ueb-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

for (const [name, j] of [["ENGLISCH", en], ["DEUTSCH", de]]) {
  if (!j) continue;
  /* Zweimal: Der erste Aufruf stösst die Übersetzung an, der zweite
     zeigt sie. Dazwischen Zeit für den Modellaufruf. */
  await s.goto(`${BASIS}/app/jobs/${j.id}`, { timeout: 120000 });
  await s.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await s.waitForTimeout(25000);
  await s.goto(`${BASIS}/app/jobs/${j.id}`, { timeout: 120000 });
  await s.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await s.getByText("Vollständige Stellenbeschreibung").click().catch(() => {});
  await s.waitForTimeout(1500);
  const t = await s.locator("main").innerText();
  console.log(`\n${name}: ${String(j.title).slice(0, 40)}`);
  console.log(`  Hinweis „Automatisch übersetzt": ${/Automatisch übersetzt/i.test(t)}`);
  console.log(`  Knopf „Original anzeigen":       ${await s.getByRole("button", { name: /Original anzeigen/i }).count() > 0}`);
  if (/Automatisch übersetzt/i.test(t)) {
    const p = t.match(/Diese Anzeige ist auf[^\n]*/);
    console.log(`  ${p ? p[0].slice(0, 120) : ""}`);
  }
}
await b.close();
