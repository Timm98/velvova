import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = sql`
  select id from jobs
  where is_demo = false
    and to_tsvector('german', title) @@ plainto_tsquery('german', 'Pflegefachkraft')
    and to_tsvector('simple', location) @@ plainto_tsquery('simple', 'Berlin')
  order by published_at desc nulls last limit 25`;
await db.execute(q);
const t = Date.now(); await db.execute(q);
console.log(`kombiniert, warm: ${Date.now()-t} ms\n`);
const r = (await db.execute(sql`explain (analyze, buffers) ${q}`)).rows;
for (const x of r) console.log("  " + Object.values(x)[0]);
process.exit(0);
