import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select
    (select count(distinct beruf)::int from beruf_zuordnung)                        as jobsuche_namen,
    (select count(*)::int from beruf_schluessel where schluessel is not null)       as dkz_namen,
    (select count(distinct z.beruf)::int from beruf_zuordnung z
       join beruf_schluessel s on s.beruf = z.beruf and s.schluessel is not null)   as treffer_exakt,
    (select count(*)::int from beruf_entgelt)                                       as entgelt_vorhanden
`)).rows[0];
const q = Number(r.treffer_exakt) / Math.max(1, Number(r.jobsuche_namen));
console.log(`Namen aus der Jobsuche (beruf_zuordnung): ${Number(r.jobsuche_namen).toLocaleString("de-DE")}`);
console.log(`Namen aus dem DKZ mit Kennung:            ${Number(r.dkz_namen).toLocaleString("de-DE")}`);
console.log(`exakt übereinstimmend:                    ${Number(r.treffer_exakt).toLocaleString("de-DE")}  (${(100*q).toFixed(1)} %)`);
console.log(`schon mit Entgelt belegt:                 ${Number(r.entgelt_vorhanden).toLocaleString("de-DE")}`);
const bsp = (await db.execute(sql`
  select z.beruf from beruf_zuordnung z
  where not exists (select 1 from beruf_schluessel s where s.beruf = z.beruf and s.schluessel is not null)
  group by z.beruf order by count(*) desc limit 6`)).rows;
if (bsp.length) { console.log("\nHäufigste ohne Kennung:"); for (const b of bsp) console.log("  ·", b.beruf); }
process.exit(0);
