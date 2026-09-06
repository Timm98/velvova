import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '7200s'`);
console.time("Index");
await db.execute(sql`
  create index concurrently if not exists jobs_land_neueste_idx
    on jobs (country, published_at desc nulls last) where is_demo = false`);
console.timeEnd("Index");
for (const land of ["US","NL","SG","DE"]) {
  const q = sql`select id from jobs where is_demo=false and country=${land}
                order by published_at desc nulls last limit 25`;
  await db.execute(q); const t=Date.now(); await db.execute(q);
  console.log(`${land}: ${Date.now()-t} ms`);
}
process.exit(0);
