import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '7200s'`);
console.time("Index");
await db.execute(sql`
  create index concurrently if not exists jobs_kandidaten_land_idx
    on jobs (country, (coalesce(published_at, fetched_at)) desc)
    where is_demo = false`);
console.timeEnd("Index");
for (const land of ["DE","GB","US"]) {
  const q = sql`select j.id from jobs j where j.is_demo=false and j.country in (${land})
                order by coalesce(j.published_at, j.fetched_at) desc limit 400`;
  await db.execute(q); const t = Date.now(); await db.execute(q);
  console.log(`${land}: ${Date.now()-t} ms`);
}
process.exit(0);
