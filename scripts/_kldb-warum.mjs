import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select
    (select count(*)::int from jobs where is_demo=false) as stellen,
    (select count(kldb)::int from jobs where is_demo=false) as mit_kldb,
    (select count(*)::int from beruf_zuordnung) as titel_gefragt,
    (select count(beruf)::int from beruf_zuordnung) as titel_mit_beruf,
    (select count(*)::int from beruf_schluessel where schluessel is not null) as namen_mit_schluessel`)).rows[0];
for (const [k,v] of Object.entries(r)) console.log(`  ${k.padEnd(22)} ${Number(v).toLocaleString("de-DE").padStart(12)}`);
const q = (await db.execute(sql`
  select count(*)::int n from jobs j
  join beruf_zuordnung z on z.titel = lower(btrim(regexp_replace(j.title,
    '\\s*\\(m/w/d\\)|\\s*\\(w/m/d\\)|\\s*m/w/d','','gi')))
  where j.is_demo=false`)).rows[0];
console.log(`  Stellen, deren Titel gefragt wurde   ${Number(q.n).toLocaleString("de-DE").padStart(12)}`);
process.exit(0);
