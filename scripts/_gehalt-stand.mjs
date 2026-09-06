import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select count(*)::int n,
    count(*) filter (where salary_disclosed)::int angegeben,
    count(*) filter (where salary_min is not null or salary_max is not null)::int mit_zahl,
    count(*) filter (where salary_period = 'year')::int jahr,
    count(*) filter (where salary_period = 'month')::int monat,
    count(*) filter (where salary_period = 'hour')::int stunde
  from jobs tablesample system (3) where country = 'DE'`)).rows;
const p = (x) => `${((x/a.n)*100).toFixed(1)} %`;
console.log(`Stichprobe ${a.n.toLocaleString("de-DE")} deutsche Stellen`);
console.log(`  Gehalt angegeben   ${String(a.angegeben).padStart(6)}  ${p(a.angegeben)}`);
console.log(`  mit Zahl           ${String(a.mit_zahl).padStart(6)}  ${p(a.mit_zahl)}`);
console.log(`  Zeitraum Jahr/Monat/Stunde: ${a.jahr} / ${a.monat} / ${a.stunde}`);
const h = (await db.execute(sql`
  select salary_provenance, count(*)::int n from jobs tablesample system (3)
  where country='DE' group by 1 order by n desc limit 6`)).rows;
console.log("\nHerkunft:");
for (const z of h) console.log(`  ${String(z.salary_provenance ?? "—").padEnd(24)} ${z.n}`);
const [e] = (await db.execute(sql`select count(*)::int n from beruf_entgelt`)).rows;
console.log(`\nberuf_entgelt (Referenzwerte): ${e.n}`);
const sp = (await db.execute(sql`
  select column_name from information_schema.columns where table_name='beruf_entgelt' order by ordinal_position`)).rows;
console.log("  Spalten:", sp.map(z => z.column_name).join(", "));
