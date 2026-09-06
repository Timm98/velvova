import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const t of ["fit_check_180", "user_job_saves"]) {
  try { await db.execute(sql.raw(`select 1 from ${t} limit 1`)); console.log(t, "existiert"); }
  catch (e) { console.log(t, "→", String(e.cause?.message ?? e.message).slice(0, 90)); }
}
const tab = (await db.execute(sql`
  select table_name from information_schema.tables
  where table_schema='public' and table_name like '%save%' or table_name like '%fit%'`)).rows;
console.log("ähnliche Tabellen:", tab.map(t => t.table_name).join(", ") || "keine");
const mig = (await db.execute(sql`select name from _migrations order by name desc limit 6`)).rows;
console.log("letzte Migrationen:", mig.map(m => m.name).join(", "));
