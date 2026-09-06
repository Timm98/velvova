import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const s = (await db.execute(sql`
  select column_name from information_schema.columns where table_name='job_ingestion_runs'`)).rows.map(r=>r.column_name);
console.log("Spalten:", s.join(", "));
const [a] = (await db.execute(sql`
  select coalesce(sum(created),0)::int neu, count(*)::int laeufe,
         extract(epoch from (max(started_at) - min(started_at)))::int spanne
  from job_ingestion_runs where started_at > now() - interval '24 hours'`)).rows;
console.log(`letzte 24 h: ${a.neu.toLocaleString("de")} neue Stellen in ${a.laeufe} Läufen`);
if (a.neu > 0) console.log(`≈ ${(a.neu / 86400).toFixed(2)} je Sekunde`);
process.exit(0);
