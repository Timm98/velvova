import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Trägt die fünfte Stelle der KldB das Anforderungsniveau?
 *
 * Wenn ja, ist sie die Brücke zum ISCO-Skill-Level — und damit lässt
 * sich aus Berufsfeld plus Niveau die ISCO-Hauptgruppe ableiten,
 * statt sie aus Text zu raten.
 */
const r = (await db.execute(sql`
  select right(schluessel, 1) niveau, count(*)::int n
  from beruf_schluessel where length(schluessel) = 5 group by 1 order by 1`)).rows;
console.log("Fünfte Stelle der KldB:");
for (const z of r) console.log(`  ${z.niveau}: ${z.n}`);

console.log("\nBeispiele je Niveau:");
for (const n of ["1", "2", "3", "4"]) {
  const b = (await db.execute(sql`
    select beruf from beruf_schluessel where length(schluessel)=5 and right(schluessel,1)=${n}
    order by random() limit 3`)).rows;
  console.log(`  ${n}: ${b.map(x => String(x.beruf).slice(0, 32)).join(" · ")}`);
}
const [j] = (await db.execute(sql`
  select count(*)::int n, count(*) filter (where length(kldb) = 5)::int fuenf
  from jobs tablesample system (2) where kldb is not null`)).rows;
console.log(`\nStellen mit KldB (Stichprobe): ${j.n} · davon fünfstellig: ${j.fuenf}`);
