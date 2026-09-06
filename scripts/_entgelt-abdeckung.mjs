import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Die Referenzcodes einmal holen — 752 Stück. */
const codes = (await db.execute(sql`
  select distinct left(s.schluessel, 5) k from beruf_entgelt e
  join beruf_schluessel s on lower(s.beruf) = lower(e.beruf)`)).rows.map(z => z.k);
const fuenf = new Set(codes);
const vier = new Set(codes.map(k => k.slice(0, 4)));
const drei = new Set(codes.map(k => k.slice(0, 3)));

const j = (await db.execute(sql`
  select kldb, count(*)::int n from jobs tablesample system (4)
  where country='DE' and kldb is not null group by 1`)).rows;

let f = 0, v = 0, d = 0, o = 0, gesamt = 0;
for (const z of j) {
  const n = Number(z.n); gesamt += n;
  const k = String(z.kldb);
  if (fuenf.has(k)) f += n;
  else if (vier.has(k.slice(0, 4))) v += n;
  else if (drei.has(k.slice(0, 3))) d += n;
  else o += n;
}
const p = (x) => `${((x/gesamt)*100).toFixed(1)} %`;
console.log(`Stellen mit KldB (Stichprobe): ${gesamt.toLocaleString("de-DE")}`);
console.log(`  genauer Beruf (5 Stellen)   ${String(f).padStart(6)}  ${p(f)}`);
console.log(`  Berufsgattung (4 Stellen)   ${String(v).padStart(6)}  ${p(v)}`);
console.log(`  Berufsuntergruppe (3)       ${String(d).padStart(6)}  ${p(d)}`);
console.log(`  keine Referenz              ${String(o).padStart(6)}  ${p(o)}`);
console.log(`\nmit irgendeiner Referenz: ${p(f+v+d)}`);
