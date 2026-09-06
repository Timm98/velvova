import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Je eine Stelle von einer Quelle mit und einer ohne Volltexterlaubnis. */
/* Je Quelle getrennt und mit Grenze — ein Join über den ganzen
   Bestand bricht unter Importlast in die Zeitgrenze. */
const paare = [];
for (const key of ["arbeitnow", "bundesagentur"]) {
  const [q] = (await db.execute(sql`select id from job_sources where key = ${key}`)).rows;
  if (!q) continue;
  const [j] = (await db.execute(sql`
    select j.id from job_source_links l join jobs j on j.id = l.job_id
    where l.source_id = ${q.id}::uuid and length(j.description) > 200 limit 1`)).rows;
  if (j) paare.push({ key, job: j.id });
}

const BASIS = "http://localhost:3000";
const b = await chromium.launch();
const s = await b.newPage({ baseURL: BASIS });
await s.goto(`${BASIS}/register`);
await s.getByLabel("E-Mail-Adresse").fill(`e2e-volltext-${Date.now()}@example.invalid`);
await s.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await s.getByRole("button", { name: /Konto anlegen/i }).click();
await s.waitForURL(/\/(app|setup)/, { timeout: 45000 });

for (const p of paare) {
  await s.goto(`${BASIS}/app/jobs/${p.job}`);
  await s.waitForLoadState("networkidle");
  const aufklappbar = await s.getByText("Vollständige Stellenbeschreibung").count();
  const hinweis = await s.getByText(/dürfen wir von dieser Quelle nicht wiedergeben/i).count();
  console.log(`${p.key.padEnd(16)} Volltext sichtbar: ${aufklappbar > 0} | Hinweis: ${hinweis > 0}`);
}
await b.close();
