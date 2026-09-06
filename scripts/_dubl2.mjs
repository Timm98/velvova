import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int zeilen,
         count(distinct (lower(btrim(title)), company_id, lower(btrim(location))))::int verschieden
  from jobs where is_demo = false`)).rows[0];
const d = r.zeilen - r.verschieden;
console.log(`Zeilen:            ${r.zeilen.toLocaleString("de-DE")}`);
console.log(`verschiedene:      ${r.verschieden.toLocaleString("de-DE")}`);
console.log(`Dubletten:         ${d.toLocaleString("de-DE")}  (${(100*d/r.zeilen).toFixed(1)} %)`);
console.log(`\nAuf 1.870.000 Anzeigen hochgerechnet: ~${Math.round(1870000 * r.verschieden / r.zeilen).toLocaleString("de-DE")} verschiedene Stellen.`);
process.exit(0);
