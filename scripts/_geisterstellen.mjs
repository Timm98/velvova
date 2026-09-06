import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Haben wir die Daten, um Geisterstellen zu MESSEN statt zu behaupten?
 *
 * Die Studien nennen 18–22 % (Greenhouse, aus dem eigenen
 * Bewerbermanagement). Für den deutschen Markt gibt es keine Zahl.
 * Wir haben 1,33 Mio. Momentaufnahmen mit Abrufzeitpunkten — daraus
 * liesse sich eine rechnen. Erst messen, ob die Spur trägt.
 */
const [a] = (await db.execute(sql`
  select
    count(*)::int gesamt,
    count(*) filter (where published_at is not null)::int mit_datum,
    count(*) filter (where expires_at is not null)::int mit_frist,
    count(*) filter (where expires_at < now())::int abgelaufen
  from jobs tablesample system (2)`)).rows;
console.log("Stichprobe 2 %:", JSON.stringify(a));

const [b] = (await db.execute(sql`
  select
    count(distinct job_id)::int stellen,
    count(*)::int aufnahmen,
    round(avg(n)::numeric, 2) schnitt,
    max(n)::int hoechstens
  from (select job_id, count(*) n from job_snapshots group by job_id limit 200000) x`)).rows;
console.log("Momentaufnahmen je Stelle:", JSON.stringify(b));

const [c] = (await db.execute(sql`
  select
    percentile_cont(0.5) within group (order by tage) median,
    percentile_cont(0.9) within group (order by tage) p90,
    max(tage) laengste
  from (
    select extract(epoch from (now() - published_at)) / 86400 tage
    from jobs tablesample system (2)
    where published_at is not null and published_at > now() - interval '3 years'
  ) x`)).rows;
console.log("Alter seit Veröffentlichung (Tage):", JSON.stringify(c));

const [d] = (await db.execute(sql`
  select count(*)::int n from (
    select company_id, lower(title), count(*) c from jobs
    where company_id is not null group by 1,2 having count(*) > 2 limit 5000) x`)).rows;
console.log("Titel je Arbeitgeber mehr als zweimal (Stichprobe):", d.n);
