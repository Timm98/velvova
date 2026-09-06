import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const messen = async (name, abfrage) => {
  const t = Date.now();
  try { const r = await db.execute(sql.raw(abfrage)); console.log(`${name.padEnd(44)} ${String(Date.now()-t).padStart(6)} ms  → ${JSON.stringify(r.rows?.[0] ?? {})}`); }
  catch (e) { console.log(`${name.padEnd(44)} FEHLER ${String(e.cause?.message ?? e.message).slice(0,50)}`); }
};
await messen("count DE", "select count(*)::int n from jobs where is_demo=false and country='DE'");
await messen("count DE + Arbeitsmodell", "select count(*)::int n from jobs where is_demo=false and country='DE' and work_model in ('hybrid','remote')");
await messen("count DE + Titelsuche", "select count(*)::int n from jobs where is_demo=false and country='DE' and lower(title) like '%pflege%'");
await messen("Index auf country?", "select indexname from pg_indexes where tablename='jobs' and indexdef ilike '%country%'");
