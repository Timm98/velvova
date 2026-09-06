import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const g = (await db.execute(sql`
  select count(*)::int as gesamt,
         count(*) filter (where latitude is not null and longitude is not null)::int as mit_koord
  from jobs where is_demo = false`)).rows[0];
console.log(`Stellen gesamt:      ${Number(g.gesamt).toLocaleString("de-DE")}`);
console.log(`mit Koordinaten:     ${Number(g.mit_koord).toLocaleString("de-DE")} (${(100*g.mit_koord/g.gesamt).toFixed(1)} %)`);
const q = (await db.execute(sql`
  select s.display_name as quelle, count(*)::int as n,
         count(*) filter (where j.latitude is not null)::int as mit
  from jobs j join job_sources s on s.id = j.source_id
  where j.is_demo = false group by s.display_name order by n desc limit 8`)).rows;
console.log("\nQuelle".padEnd(30), "Stellen".padStart(10), "mit Koord.".padStart(12), "Anteil".padStart(8));
for (const r of q) {
  console.log(String(r.quelle).padEnd(30), Number(r.n).toLocaleString("de-DE").padStart(10),
    Number(r.mit).toLocaleString("de-DE").padStart(12), `${(100*r.mit/r.n).toFixed(0)} %`.padStart(8));
}
process.exit(0);
