import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select
    count(*) filter (where j.fetched_at > now() - interval '20 minutes')::int neu,
    count(*) filter (where j.fetched_at > now() - interval '20 minutes'
      and exists (select 1 from job_source_links l where l.job_id = j.id))::int neu_mit,
    count(*) filter (where j.fetched_at <= now() - interval '20 minutes')::int alt,
    count(*) filter (where j.fetched_at <= now() - interval '20 minutes'
      and exists (select 1 from job_source_links l where l.job_id = j.id))::int alt_mit
  from jobs j where j.is_demo = false`)).rows[0];
console.log(`zuletzt angefasst (20 Min): ${r.neu} Stellen, davon mit Fundstelle ${r.neu_mit}  → ${r.neu ? (100*r.neu_mit/r.neu).toFixed(1) : 0} %`);
console.log(`älter:                      ${r.alt} Stellen, davon mit Fundstelle ${r.alt_mit}  → ${r.alt ? (100*r.alt_mit/r.alt).toFixed(1) : 0} %`);
process.exit(0);
