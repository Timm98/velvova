import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
/* Schätzwert: count(*) bricht bei laufenden Importen in die Zeitgrenze. */
const [a] = (await db.execute(sql`
  select reltuples::bigint n from pg_class where relname = 'jobs'`)).rows;
console.log("Stellen (Schätzwert):", Number(a.n).toLocaleString("de-DE"));
