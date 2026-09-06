import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select
    (select count(*)::int from jobs where is_demo=false) stellen,
    (select count(distinct lower(btrim(title)))::int from jobs where is_demo=false) titel,
    (select count(*)::int from beruf_zuordnung) zugeordnet,
    (select count(*)::int from beruf_entgelt) referenzen,
    (select count(*)::int from beruf_wortschatz) wortschatz`)).rows[0];
console.log(r);
console.log(`\nTitel ohne Zuordnung: rund ${r.titel - r.zugeordnet} — für die greift keine Schätzung.`);
process.exit(0);
