import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`select reltuples::bigint n from pg_class where relname='jobs'`)).rows;
console.log("Stellen im Bestand (Schaetzwert pg_class):", Number(a.n).toLocaleString("de"));
try {
  const r = (await db.execute(sql`select * from bestandskennzahlen order by berechnet_am desc limit 1`)).rows;
  if (r[0]) console.log("bestandskennzahlen:", JSON.stringify(r[0]));
} catch (e) { console.log("bestandskennzahlen:", e.message.slice(0,80)); }
process.exit(0);
