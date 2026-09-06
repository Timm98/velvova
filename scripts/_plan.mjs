import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = await db.execute(sql`
  explain (analyze, buffers, format text)
  select j.id, j.title, c.name
  from jobs j
  join companies c on c.id = j.company_id
  where j.is_demo = false
  order by coalesce(j.published_at, j.fetched_at) desc
  limit 2000`);
for (const z of (r.rows ?? r)) console.log(" ", Object.values(z)[0]);
process.exit(0);
