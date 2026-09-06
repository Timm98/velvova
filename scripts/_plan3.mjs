import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const messen = async (name, q) => {
  await db.execute(q);
  const t0 = Date.now();
  await db.execute(q);
  console.log(`  ${name.padEnd(40)} ${String(Date.now()-t0).padStart(6)} ms`);
};
const basis = "from jobs j where j.is_demo=false order by coalesce(j.published_at, j.fetched_at) desc limit 2000";
console.log("Spalten                                    Dauer");
await messen("id", sql`select j.id ${sql.raw(basis)}`);
await messen("+ Titel, Ort, Gehalt, Daten", sql`
  select j.id, j.title, j.location, j.country, j.work_model, j.salary_min, j.salary_max,
         j.salary_period, j.salary_disclosed, j.published_at, j.fetched_at ${sql.raw(basis)}`);
await messen("+ core_tasks", sql`select j.id, j.core_tasks ${sql.raw(basis)}`);
await messen("+ benefits", sql`select j.id, j.benefits ${sql.raw(basis)}`);
await messen("+ original_url", sql`select j.id, j.original_url ${sql.raw(basis)}`);
await messen("+ language_requirements, licenses", sql`
  select j.id, j.language_requirements, j.required_licenses ${sql.raw(basis)}`);
const g = (await db.execute(sql`
  select avg(length(core_tasks::text))::int ct, avg(length(benefits::text))::int b,
         avg(length(title))::int t
  from (select core_tasks, benefits, title from jobs where is_demo=false
        order by coalesce(published_at, fetched_at) desc limit 2000) x`)).rows[0];
console.log(`\nMittlere Grösse je Zeile: core_tasks ${g.ct} B · benefits ${g.b} B · title ${g.t} B`);
process.exit(0);
