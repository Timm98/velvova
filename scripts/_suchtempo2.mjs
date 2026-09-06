import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const wort of ["Pflegefachkraft", "Softwareentwickler", "Lagerhelfer", "Kundenbetreuung", "Pflegekräfte"]) {
  const t0 = Date.now();
  const r = (await db.execute(sql`
    select id, title from jobs
    where is_demo = false
      and to_tsvector('german', title) @@ plainto_tsquery('german', ${wort})
    order by published_at desc nulls last
    limit 20`)).rows;
  console.log(`${wort.padEnd(20)} ${String((Date.now()-t0)).padStart(6)} ms · ${r.length} Treffer · ${r[0]?.title?.slice(0,45) ?? "-"}`);
}
process.exit(0);
