import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const wort of ["Softwareentwickler", "Pflegefachkraft", "Mitarbeiter", "Verkäufer"]) {
  const [c] = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false
    and to_tsvector('german', title) @@ plainto_tsquery('german', ${wort})`)).rows;
  const direkt = sql`select id from jobs where is_demo=false
      and to_tsvector('german', title) @@ plainto_tsquery('german', ${wort})
    order by published_at desc nulls last limit 25`;
  const cte = sql`with treffer as materialized (
      select id, published_at from jobs where is_demo=false
        and to_tsvector('german', title) @@ plainto_tsquery('german', ${wort}))
    select id from treffer order by published_at desc nulls last limit 25`;
  await db.execute(direkt); let t = Date.now(); await db.execute(direkt); const a = Date.now()-t;
  await db.execute(cte);    t = Date.now(); await db.execute(cte);    const b = Date.now()-t;
  console.log(`${wort.padEnd(20)} ${String(c.n).padStart(8)} Treffer · direkt ${String(a).padStart(6)} ms · materialisiert ${String(b).padStart(5)} ms`);
}
process.exit(0);
