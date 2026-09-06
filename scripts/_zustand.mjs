import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/*
 * Schätzwerte statt count(*).
 *
 * Bei 1,58 Mio. Zeilen und fünf laufenden Importen bricht ein
 * count(*) auf `jobs` in die Zeitgrenze. Der Planer-Schätzwert aus
 * pg_class kostet nichts und reicht für eine Bestandsaufnahme.
 */
const r = (await db.execute(sql`
  select relname, reltuples::bigint n from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r'
  order by reltuples desc`)).rows;
for (const z of r) {
  if (Number(z.n) < 1) continue;
  console.log(z.relname.padEnd(30), Number(z.n).toLocaleString("de-DE").padStart(12));
}
