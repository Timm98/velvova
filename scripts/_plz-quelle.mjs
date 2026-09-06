import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
/* Steckt eine Postleitzahl im Ortstext? Stichprobe statt Volltabelle. */
const r = (await db.execute(sql`
  select location, raw_payload->'arbeitsorte'->0->>'plz' plz
  from jobs j join job_snapshots s on s.job_id = j.id
  where j.country = 'DE' and j.location is not null limit 5`)).rows;
for (const z of r) console.log(JSON.stringify(z));
const [a] = (await db.execute(sql`
  select count(*)::int n from jobs tablesample system (1)
  where country='DE' and location ~ '\\d{5}'`)).rows;
console.log("Orte mit fünfstelliger Zahl (1 %-Stichprobe):", a.n);
