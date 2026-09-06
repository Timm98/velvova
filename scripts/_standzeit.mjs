import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Ist „alt" dasselbe wie „Geisterstelle"?
 *
 * Nein — und das ist der Punkt. Eine Pflegestelle steht ein halbes
 * Jahr, weil niemand kommt. Eine Bürostelle, die ein halbes Jahr
 * steht, während vergleichbare nach drei Wochen weg sind, ist etwas
 * anderes. Wenn die Berufsgruppen sich stark unterscheiden, taugt
 * nur der Vergleich innerhalb der Gruppe.
 */
const r = (await db.execute(sql`
  select
    substring(kldb from 1 for 2) gruppe,
    count(*)::int n,
    percentile_cont(0.5) within group (order by extract(epoch from (now() - published_at)) / 86400) median,
    percentile_cont(0.9) within group (order by extract(epoch from (now() - published_at)) / 86400) p90
  from jobs
  where kldb is not null and published_at is not null and country = 'DE'
    and published_at > now() - interval '3 years'
  group by 1 having count(*) > 3000
  order by median desc`)).rows;

console.log("Gruppe   Stellen    Median   p90   (Tage)");
console.log("─".repeat(48));
for (const z of r) {
  console.log(`  ${z.gruppe}   ${String(z.n).padStart(7)}   ${Number(z.median).toFixed(0).padStart(6)}  ${Number(z.p90).toFixed(0).padStart(5)}`);
}
const med = r.map(z => Number(z.median)).sort((a,b)=>a-b);
console.log(`\n${r.length} Gruppen | kleinster Median ${med[0]?.toFixed(0)} | grösster ${med[med.length-1]?.toFixed(0)} Tage`);
