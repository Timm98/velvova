import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int gesamt,
         count(anzeigen)::int gefragt,
         count(*) filter (where anzeigen >= 1000)::int ab1000,
         count(*) filter (where anzeigen between 100 and 999)::int ab100,
         count(*) filter (where anzeigen between 1 and 99)::int klein,
         count(*) filter (where anzeigen = 0)::int leer
  from beruf_wortschatz`)).rows[0];
console.log(`Wortschatz gesamt:        ${r.gesamt}`);
console.log(`  Trefferzahl bekannt:    ${r.gefragt}`);
console.log(`    ≥ 1.000 Anzeigen:     ${r.ab1000}`);
console.log(`    100–999 Anzeigen:     ${r.ab100}`);
console.log(`    1–99 Anzeigen:        ${r.klein}`);
console.log(`    ohne Treffer:         ${r.leer}`);
process.exit(0);
