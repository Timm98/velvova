import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const a = (await db.execute(sql`
  select phase, round(100.0*blocks_done/nullif(blocks_total,0))::int pct,
         round(100.0*tuples_done/nullif(tuples_total,0))::int tpct
  from pg_stat_progress_create_index`)).rows;
console.log(a.length ? JSON.stringify(a[0]) : "kein Indexaufbau aktiv");
const i = (await db.execute(sql`
  select indexname from pg_indexes where tablename='jobs' and indexname like '%kandidaten%'`)).rows;
console.log("vorhanden:", i.map(x=>x.indexname).join(", "));
process.exit(0);
