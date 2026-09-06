import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '7200s'`);
console.time("Ortsindex");
await db.execute(sql`
  create index concurrently if not exists jobs_ort_idx
    on jobs using gin (to_tsvector('simple', location)) where is_demo = false`);
console.timeEnd("Ortsindex");
for (const ort of ["Berlin", "München", "Karlsruhe"]) {
  const t0 = Date.now();
  const [c] = (await db.execute(sql`
    select count(*)::int n from jobs where is_demo=false
      and to_tsvector('simple', location) @@ plainto_tsquery('simple', ${ort})`)).rows;
  console.log(`${ort.padEnd(12)} ${String(Date.now()-t0).padStart(6)} ms · ${c.n.toLocaleString("de")} Stellen`);
}
const [u] = (await db.execute(sql`
  select count(*)::int n from jobs where is_demo=false and location ilike '%Überlingen%'
    and to_tsvector('simple', location) @@ plainto_tsquery('simple', 'Berlin')`)).rows;
console.log("Ueberlingen faelschlich als Berlin:", u.n);
process.exit(0);
