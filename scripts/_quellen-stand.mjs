/** Zeigt je Quelle den Bestand und was in den letzten 24 Stunden dazukam. */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select s.display_name as name,
         count(*) filter (where j.fetched_at > now() - interval '24 hours') as heute,
         count(*) as gesamt
  from jobs j join job_sources s on s.id = j.source_id
  where j.is_demo = false
  group by s.display_name order by gesamt desc limit 14`)).rows;
console.log("Quelle".padEnd(30), "24 h".padStart(9), "gesamt".padStart(10));
for (const x of r) console.log(String(x.name).padEnd(30), Number(x.heute).toLocaleString("de-DE").padStart(9), Number(x.gesamt).toLocaleString("de-DE").padStart(10));
const g = (await db.execute(sql`select count(*)::int as n from jobs where is_demo = false`)).rows[0];
console.log("\nBestand gesamt:", Number(g.n).toLocaleString("de-DE"));
process.exit(0);
