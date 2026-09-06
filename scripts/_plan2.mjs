import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const messen = async (name, q) => {
  await db.execute(q);
  const t0 = Date.now();
  await db.execute(q);
  console.log(`  ${name.padEnd(46)} ${String(Date.now()-t0).padStart(6)} ms`);
};

console.log("Abfrage                                          Dauer");
await messen("nur Stellen, wenige Spalten", sql`
  select j.id from jobs j where j.is_demo=false
  order by coalesce(j.published_at, j.fetched_at) desc limit 2000`);
await messen("Stellen, viele Spalten", sql`
  select j.id, j.title, j.location, j.country, j.work_model, j.salary_min, j.salary_max,
         j.salary_currency, j.salary_period, j.salary_disclosed, j.contract_type, j.weekly_hours,
         j.shift_work, j.core_tasks, j.benefits, j.description_length, j.published_at,
         j.fetched_at, j.original_url, j.source_id, j.content_hash, j.kldb, j.experience_level
  from jobs j where j.is_demo=false
  order by coalesce(j.published_at, j.fetched_at) desc limit 2000`);
await messen("mit Firmen-Join", sql`
  select j.id, j.title, c.name, c.mitarbeiter, c.industry, c.headquarters
  from jobs j join companies c on c.id=j.company_id where j.is_demo=false
  order by coalesce(j.published_at, j.fetched_at) desc limit 2000`);
await messen("Anforderungen für 2000 Kennungen", sql`
  select * from job_requirements where job_id in (
    select id from jobs where is_demo=false
    order by coalesce(published_at, fetched_at) desc limit 2000)`);
process.exit(0);
