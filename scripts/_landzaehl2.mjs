import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '300s'`);
const laender = (await db.execute(sql`select land from laenderbestand order by land`)).rows.map(r=>r.land);
const t = Date.now();
let summe = 0;
for (const l of laender) {
  const [c] = (await db.execute(sql`
    select count(*)::bigint n from jobs where is_demo = false and country = ${l}`)).rows;
  summe += Number(c.n);
}
console.log(`je Land einzeln: ${((Date.now()-t)/1000).toFixed(1)} s für ${laender.length} Länder, ${summe.toLocaleString("de")} Stellen`);
process.exit(0);
