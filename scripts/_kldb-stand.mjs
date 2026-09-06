import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const s = (await db.execute(sql`
  select count(*)::int as gesamt, count(kldb)::int as mit,
         count(distinct left(kldb,2))::int as hauptgruppen
  from jobs where is_demo=false`)).rows[0];
console.log(`${Number(s.mit).toLocaleString("de-DE")} von ${Number(s.gesamt).toLocaleString("de-DE")} mit Kennung (${(100*s.mit/s.gesamt).toFixed(1)} %) · ${s.hauptgruppen} Berufshauptgruppen`);
process.exit(0);
