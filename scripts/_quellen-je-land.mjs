import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '900s'`);
const r = (await db.execute(sql`
  select j.country, s.display_name, count(*)::int n
  from jobs j join job_sources s on s.id = j.source_id
  where j.is_demo = false
  group by 1,2 having count(*) > 50
  order by j.country, n desc`)).rows;
const proLand = {};
for (const x of r) (proLand[x.country] ??= []).push(x.display_name);
for (const [land, q] of Object.entries(proLand).sort()) console.log(`${land}: ${q.join(", ")}`);
process.exit(0);
