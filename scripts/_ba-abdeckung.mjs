import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int n from jobs j join job_sources s on s.id = j.source_id
  where s.display_name = 'Bundesagentur für Arbeit' and j.is_demo = false`)).rows[0];

const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const a = await fetch("https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?size=1&page=1",
  { headers: K, signal: AbortSignal.timeout(20000) });
const d = await a.json();
const gesamt = d?.maxErgebnisse ?? 0;

console.log(`Bundesagentur gesamt:  ${gesamt.toLocaleString("de-DE")}`);
console.log(`davon bei uns:         ${r.n.toLocaleString("de-DE")}`);
console.log(`Abdeckung:             ${(100 * r.n / gesamt).toFixed(1)} %`);
console.log(`noch offen:            ${(gesamt - r.n).toLocaleString("de-DE")}`);
process.exit(0);
