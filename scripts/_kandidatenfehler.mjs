import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = sql`
  select j.id, j.title, c.name from jobs j
  inner join companies c on c.id = j.company_id
  where j.is_demo = false and j.country in ('DE')
  order by coalesce(j.published_at, j.fetched_at) desc
  limit 400`;
const t = Date.now();
try {
  const r = (await db.execute(q)).rows;
  console.log(`OK: ${r.length} Zeilen in ${Date.now()-t} ms`);
} catch (e) {
  console.log(`FEHLER nach ${Date.now()-t} ms: ${e.message?.slice(0,120)}`);
  console.log("  code:", e.cause?.code ?? e.code);
}
process.exit(0);
