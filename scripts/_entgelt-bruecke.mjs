import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Treffen die Namen der Entgeltwerte die amtlichen Berufsschlüssel?
 *
 * Beide Tabellen stammen von derselben Quelle und benutzen dieselben
 * Bezeichnungen. Wenn das aufgeht, ist die Brücke ein exakter
 * Vergleich — kein Textabgleich, kein Raten.
 */
const [a] = (await db.execute(sql`
  select
    count(*)::int gesamt,
    count(*) filter (where exists (
      select 1 from beruf_schluessel s where s.beruf = e.beruf))::int genau,
    count(*) filter (where exists (
      select 1 from beruf_schluessel s where lower(s.beruf) = lower(e.beruf)))::int ohne_gross
  from beruf_entgelt e`)).rows;
console.log(`Entgeltwerte: ${a.gesamt}`);
console.log(`  exakt in beruf_schluessel:      ${a.genau}  (${(100*a.genau/a.gesamt).toFixed(1)} %)`);
console.log(`  ohne Gross-/Kleinschreibung:    ${a.ohne_gross}  (${(100*a.ohne_gross/a.gesamt).toFixed(1)} %)`);

const fehl = (await db.execute(sql`
  select e.beruf from beruf_entgelt e
  where not exists (select 1 from beruf_schluessel s where lower(s.beruf) = lower(e.beruf))
  limit 6`)).rows;
console.log("\nohne Treffer, Beispiele:");
for (const z of fehl) console.log("  ", z.beruf);

const [b] = (await db.execute(sql`
  select count(distinct left(s.schluessel, 5))::int kldb
  from beruf_entgelt e join beruf_schluessel s on lower(s.beruf) = lower(e.beruf)`)).rows;
console.log(`\nverschiedene KldB-Codes mit Entgeltwert: ${b.kldb}`);
