import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '300s'`);
const t = Date.now();
try {
  const r = (await db.execute(sql`
    select country, count(*)::bigint n from jobs
    where is_demo = false and country is not null and country <> ''
    group by country`)).rows;
  console.log(`bisherige Abfrage: ${((Date.now()-t)/1000).toFixed(1)} s, ${r.length} Länder`);
} catch (e) { console.log(`bisherige Abfrage scheitert nach ${((Date.now()-t)/1000).toFixed(1)} s`); }

const t2 = Date.now();
const r2 = (await db.execute(sql`
  select country, count(*)::bigint n from jobs
  where is_demo = false
  group by country`)).rows;
console.log(`ohne null-Prüfung:  ${((Date.now()-t2)/1000).toFixed(1)} s, ${r2.length} Länder`);
process.exit(0);
