import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int gesamt,
    count(website)::int website, count(industry)::int branche,
    count(size_band)::int groesse, count(headquarters)::int sitz
  from companies where is_demo = false`)).rows[0];
console.log(`Firmen: ${r.gesamt.toLocaleString("de-DE")}`);
for (const [k, v] of [["Website", r.website], ["Branche", r.branche], ["Grösse", r.groesse], ["Hauptsitz", r.sitz]])
  console.log(`  ${k.padEnd(12)} ${String(v).padStart(7)}  (${(100*v/r.gesamt).toFixed(1)} %)`);
process.exit(0);
