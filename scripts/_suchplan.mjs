import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [c] = (await db.execute(sql`
  select count(*)::int n from jobs where is_demo=false
    and to_tsvector('german', title) @@ plainto_tsquery('german', 'Pflegefachkraft')`)).rows;
console.log("Treffer gesamt fuer Pflegefachkraft:", c.n.toLocaleString("de"));
const r = (await db.execute(sql`
  explain (analyze, buffers, format text)
  select id, title from jobs where is_demo=false
    and to_tsvector('german', title) @@ plainto_tsquery('german', 'Pflegefachkraft')
  order by published_at desc nulls last limit 20`)).rows;
for (const x of r) console.log("  " + Object.values(x)[0]);
process.exit(0);
