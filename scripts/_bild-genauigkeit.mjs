import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { berufsbild } = await import("../apps/web/src/lib/jobs/berufsbild.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select j.id, j.title, j.kldb, z.beruf
  from jobs j
  left join beruf_zuordnung z on z.titel = lower(btrim(regexp_replace(j.title,
    '\\s*\\(m/w/d\\)|\\s*\\(w/m/d\\)|\\s*m/w/d','','gi')))
  where j.kldb is not null and j.is_demo=false
  order by md5(j.id::text) limit 22`)).rows;
console.log("KldB  Beruf".padEnd(46), "Motiv");
for (const x of r) {
  const mitKennung = berufsbild({ id: String(x.id), title: String(x.title), kldb: String(x.kldb) });
  const ohne = berufsbild({ id: String(x.id), title: String(x.title) });
  const gleich = mitKennung.foto?.gross === ohne.foto?.gross;
  const m = String(mitKennung.foto?.gross ?? "—").replace("/fotos/beruf/","").replace(".webp","");
  const o = String(ohne.foto?.gross ?? "—").replace("/fotos/beruf/","").replace(".webp","");
  console.log(
    `${String(x.kldb).slice(0,2)}    ${String(x.beruf ?? x.title).slice(0,38).padEnd(40)} ${m.padEnd(26)}` +
    (gleich ? "" : `  (vorher: ${o})`));
}
process.exit(0);
