/**
 * Sind die Dublettengruppen Fehler oder korrekt getrennte Stellen?
 *
 * Die Frage lässt sich nur an den Fundstellen entscheiden: zwei
 * Anzeigen desselben Anbieters mit gleichem Titel sind zwei
 * Ausschreibungen, zwei Anzeigen VERSCHIEDENER Anbieter sind dieselbe
 * Stelle und hätten zusammengeführt werden müssen.
 *
 *   node scripts/dubletten-pruefung.mjs
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const gruppen = (await db.execute(sql`
  select lower(j.title) as t, c.name as f, lower(split_part(j.location, ',', 1)) as o,
         count(*)::int as n,
         array_agg(distinct s.display_name) as quellen,
         array_agg(j.original_url) as urls
  from jobs j
  join companies c on c.id = j.company_id
  join job_sources s on s.id = j.source_id
  group by 1,2,3 having count(*) > 1
  order by 4 desc
`)).rows ?? [];

let gleicheQuelle = 0, verschiedeneQuellen = 0;
console.log(`${gruppen.length} Gruppen mit gleichem Titel + Firma + Ort\n`);
for (const g of gruppen) {
  const einQuelle = g.quellen.length === 1;
  if (einQuelle) gleicheQuelle++; else verschiedeneQuellen++;
  const gleicheUrl = new Set(g.urls).size === 1;
  console.log(`  ${g.n}× ${String(g.t).slice(0, 40).padEnd(40)} [${g.quellen.join("+")}]${einQuelle ? "" : "  ← ANBIETERÜBERGREIFEND"}${gleicheUrl ? "  ← GLEICHE URL" : ""}`);
}

console.log(`\n  ${gleicheQuelle} Gruppen innerhalb einer Quelle — mehrere Ausschreibungen, korrekt getrennt.`);
console.log(`  ${verschiedeneQuellen} Gruppen über Quellen hinweg — hätten zusammengeführt werden müssen.`);

// Gegenprobe: wurde überhaupt je zusammengeführt?
const links = (await db.execute(sql`
  select job_id, count(distinct source_id)::int as quellen
  from job_source_links group by job_id having count(distinct source_id) > 1
`)).rows ?? [];
console.log(`\n  ${links.length} Stellen sind bereits über mehrere Quellen verknüpft.`);
process.exit(0);
