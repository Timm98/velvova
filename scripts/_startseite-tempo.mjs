import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wo die 23 Sekunden der Startseite hingehen.
 *
 * Messen statt raten: jede Abfrage einzeln, gegen die echte
 * Datenbank unter laufendem Import.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const messen = async (name, abfrage) => {
  const t = Date.now();
  try { await db.execute(sql.raw(abfrage)); }
  catch (e) { console.log(`${name.padEnd(38)} FEHLER ${String(e.cause?.message ?? e.message).slice(0, 40)}`); return; }
  console.log(`${name.padEnd(38)} ${String(Date.now() - t).padStart(6)} ms`);
};

await messen("eine Stelle nach id", "select id from jobs order by id limit 1");
await messen("Stellen nach Land+Datum", "select id from jobs where country='DE' order by published_at desc limit 3");
await messen("Stellen mit Gehaltsfilter",
  "select id from jobs where country='DE' and salary_min is not null order by published_at desc limit 3");
await messen("Trichter (applications)", "select status, count(*) from applications group by 1");
await messen("Kennzahlen nachschlagen", "select * from bestandskennzahlen where quelle = ''");
await messen("Quellen", "select key, display_name from job_sources");
