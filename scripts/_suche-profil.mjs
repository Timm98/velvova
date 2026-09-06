import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const W = (a) => sql.raw(`${a}.is_demo = false and to_tsvector('german', ${a}.title) @@ plainto_tsquery('german', 'Softwareentwickler')`);

const messe = async (name, q) => {
  const t = Date.now();
  await db.execute(q);
  console.log(`${name.padEnd(30)}: ${Date.now()-t} ms`);
};
await messe("nur jobs, sortiert, limit 25", sql`select 1 from jobs where ${W("jobs")} order by jobs.published_at desc limit 25`);
await messe("gedeckelte Zaehlung", sql`select count(*)::int n from (select 1 from jobs where ${W("jobs")} limit 1000) x`);
await messe("mit beiden Verbunden", sql`
  select j.id, c.name from jobs j join companies c on c.id=j.company_id join job_sources s on s.id=j.source_id
  where ${W("j")} order by j.published_at desc limit 25`);
await messe("Verbund erst nach dem Limit", sql`
  select j2.id, c.name from (
    select id, company_id, source_id from jobs where ${W("jobs")} order by published_at desc limit 25
  ) j2 join companies c on c.id=j2.company_id join job_sources s on s.id=j2.source_id`);
process.exit(0);
