import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select s.display_name as quelle, r.raw_payload
  from job_snapshots r join jobs j on j.id = r.job_id join job_sources s on s.id = j.source_id
  where s.display_name in ('Bundesagentur für Arbeit','JSearch','Arbeitnow') limit 3`)).rows;
for (const x of r) {
  const p = typeof x.raw_payload === "string" ? JSON.parse(x.raw_payload) : x.raw_payload;
  console.log(`── ${x.quelle}: Schlüssel = ${Object.keys(p ?? {}).slice(0,20).join(", ") || "LEER"}`);
  console.log("   " + JSON.stringify(p).slice(0, 300));
}
process.exit(0);
