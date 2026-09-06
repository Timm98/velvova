import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const g = (await db.execute(sql`
  select count(*)::int stellen,
         (select count(*)::int from job_source_links) as fundstellen
  from jobs where is_demo = false`)).rows[0];
console.log(`Stellen: ${g.stellen} · Fundstellen: ${g.fundstellen}  → ${(100*g.fundstellen/g.stellen).toFixed(1)} % haben eine`);

const d = (await db.execute(sql`
  select count(*)::int n from (
    select lower(btrim(j.title)) t, j.company_id, lower(btrim(j.location)) o,
           count(distinct j.source_id)::int quellen, count(*)::int mal
    from jobs j where j.is_demo = false
    group by 1,2,3
    having count(*) > 1 and count(distinct j.source_id) > 1
  ) x`)).rows[0];
console.log(`Dieselbe Stelle als mehrere Zeilen bei verschiedenen Quellen: ${d.n} Gruppen`);

for (const r of (await db.execute(sql`
  select lower(btrim(j.title)) t, count(*)::int mal, count(distinct j.source_id)::int quellen
  from jobs j where j.is_demo = false
  group by 1, j.company_id, lower(btrim(j.location))
  having count(*) > 1 and count(distinct j.source_id) > 1
  order by 2 desc limit 5`)).rows)
  console.log(`   ${r.mal}× aus ${r.quellen} Quellen: ${String(r.t).slice(0,58)}`);
process.exit(0);
