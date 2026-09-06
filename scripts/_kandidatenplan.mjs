import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '120s'`);
const r = (await db.execute(sql`
  explain (analyze, buffers)
  select j.id from jobs j
  where j.is_demo = false and j.country in ('DE')
  order by coalesce(j.published_at, j.fetched_at) desc
  limit 400`)).rows;
for (const x of r) console.log("  " + Object.values(x)[0]);
process.exit(0);
